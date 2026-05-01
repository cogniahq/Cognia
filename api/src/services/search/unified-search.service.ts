import { prisma } from '../../lib/prisma.lib'
import { ensureCollection } from '../../lib/qdrant.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { SourceType } from '@prisma/client'
import { createSearchJob, setSearchJobResult } from './search-job.service'
import {
  buildMemoryPreviewText,
  buildMemoryRetrievalText,
  normalizePageMetadata,
} from '../memory/memory-structure.service'
import { generateQueryEmbedding } from './embedding-search.service'
import { hybridSearch, type HybridSearchHit } from './hybrid-search.service'
import { rerankProvider } from './rerank-provider.service'
import { searchCache } from './search-cache.service'
import { tokenizeQuery } from './query-processor.service'
import { isRateLimitError } from '../../utils/core/retry.util'
import { SEARCH_CONSTANTS } from '../../utils/core/constants.util'

const ANSWER_CONTEXT_CHARS = 320
const MAX_ANSWER_RESULTS = 12
const MAX_ANSWER_CANDIDATES = 36
const MAX_ANSWER_CONTEXT_TOTAL_CHARS = 2200
const MAX_ANSWER_CHUNKS_PER_SOURCE = 2
const MAX_FALLBACK_CITATIONS = 5

type PublicSearchResult = UnifiedSearchResult['results'][number]
type InternalSearchResult = PublicSearchResult & {
  answerContent: string
  metadata?: Record<string, unknown>
  authorEmail?: string | null
  capturedAt?: string | null
}

const SEARCH_METADATA_KEYS = ['tags'] as const

export interface UnifiedSearchOptions {
  organizationId: string
  query: string
  sourceTypes?: SourceType[]
  limit?: number
  includeAnswer?: boolean
  userId?: string // Include user's personal extension data in search
}

export interface UnifiedSearchResult {
  results: Array<{
    memoryId: string
    documentId?: string
    documentName?: string
    chunkIndex?: number
    pageNumber?: number
    highlightText?: string
    content: string
    contentPreview: string
    score: number
    sourceType: SourceType
    title?: string
    url?: string
    metadata?: Record<string, unknown>
  }>
  answer?: string
  citations?: Array<{
    index: number
    documentName?: string
    pageNumber?: number
    memoryId: string
    url?: string
    sourceType?: SourceType
    authorEmail?: string | null
    capturedAt?: string | null
  }>
  totalResults: number
  answerJobId?: string // Job ID for async answer generation
}

export class UnifiedSearchService {
  private pickResultMetadata(
    pageMetadata: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    const metadataEntries = SEARCH_METADATA_KEYS.flatMap(key => {
      const value = pageMetadata[key]
      if (value === undefined || value === null) {
        return []
      }

      if (typeof value === 'string' && !value.trim()) {
        return []
      }

      if (Array.isArray(value) && value.length === 0) {
        return []
      }

      return [[key, value] as const]
    })

    return metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined
  }

  private getAnswerQueryTerms(query: string): string[] {
    const semanticTokens = tokenizeQuery(query)
    const sectionTokens =
      query
        .toLowerCase()
        .match(/\b[a-z]*\d+[a-z]*\b/g)
        ?.filter(token => token.length >= 2) || []

    return Array.from(new Set([...sectionTokens, ...semanticTokens])).sort((a, b) => {
      const aHasDigits = /\d/.test(a)
      const bHasDigits = /\d/.test(b)
      if (aHasDigits !== bHasDigits) {
        return aHasDigits ? -1 : 1
      }

      return b.length - a.length
    })
  }

  private getAnswerCandidateResults(
    query: string,
    results: InternalSearchResult[]
  ): InternalSearchResult[] {
    const queryTokens = this.getAnswerQueryTerms(query)
    const scoredCandidates = results.slice(0, MAX_ANSWER_CANDIDATES).map((result, index) => ({
      result,
      originalIndex: index,
      sourceKey: this.getAnswerSourceKey(result),
      score: this.scoreAnswerCandidate(query, queryTokens, result),
    }))

    const groupedCandidates = new Map<
      string,
      Array<{
        result: InternalSearchResult
        originalIndex: number
        sourceKey: string
        score: number
      }>
    >()

    for (const candidate of scoredCandidates) {
      const existingGroup = groupedCandidates.get(candidate.sourceKey) || []
      existingGroup.push(candidate)
      groupedCandidates.set(candidate.sourceKey, existingGroup)
    }

    const orderedGroups = Array.from(groupedCandidates.values())
      .map(group =>
        group.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score
          }

          return a.originalIndex - b.originalIndex
        })
      )
      .sort((a, b) => {
        if (b[0].score !== a[0].score) {
          return b[0].score - a[0].score
        }

        return a[0].originalIndex - b[0].originalIndex
      })

    const selectedResults: InternalSearchResult[] = []

    for (let round = 0; round < MAX_ANSWER_CHUNKS_PER_SOURCE; round += 1) {
      for (const group of orderedGroups) {
        const candidate = group[round]
        if (!candidate) {
          continue
        }

        selectedResults.push(candidate.result)
        if (selectedResults.length >= MAX_ANSWER_RESULTS) {
          return selectedResults
        }
      }
    }

    return selectedResults
  }

  private getAnswerResults(
    query: string,
    results: InternalSearchResult[]
  ): Array<{
    result: InternalSearchResult
    sourceLabel: string
    contextSnippet: string
  }> {
    const answerCandidates = this.getAnswerCandidateResults(query, results)
    const selectedResults: Array<{
      result: InternalSearchResult
      sourceLabel: string
      contextSnippet: string
    }> = []

    let totalContextChars = 0

    for (const [index, result] of answerCandidates.entries()) {
      const sourceLabel = result.documentName
        ? `[${index + 1}] Document: ${result.documentName}${result.pageNumber ? ` (Page ${result.pageNumber})` : ''}`
        : `[${index + 1}] ${result.title || 'Memory'}`
      const contextSnippet = this.buildAnswerContextSnippet(query, result)
      const entryLength = sourceLabel.length + contextSnippet.length + 2

      if (
        selectedResults.length > 0 &&
        totalContextChars + entryLength > MAX_ANSWER_CONTEXT_TOTAL_CHARS
      ) {
        break
      }

      selectedResults.push({
        result,
        sourceLabel,
        contextSnippet,
      })
      totalContextChars += entryLength
    }

    return selectedResults
  }

  private buildAnswerContextSnippet(query: string, result: InternalSearchResult): string {
    const normalizedContent = result.content.replace(/\s+/g, ' ').trim()
    const normalizedAnswerContent = (result.answerContent || '').replace(/\s+/g, ' ').trim()
    const normalizedPreview = result.contentPreview.replace(/\s+/g, ' ').trim()
    const answerSourceContent = normalizedAnswerContent || normalizedContent

    if (!answerSourceContent) {
      return normalizedPreview
    }

    const queryTokens = this.getAnswerQueryTerms(query)
    const segments = answerSourceContent
      .split(/\n{2,}|(?<=[.!?])\s+|(?<=:)\s+|(?<=;)\s+|\s[*•-]\s+/)
      .map(segment => segment.trim())
      .filter(Boolean)

    if (segments.length === 0) {
      return this.truncateAnswerSnippet(answerSourceContent, queryTokens)
    }

    const matchingSegments = segments
      .map((segment, index) => {
        const lowerSegment = segment.toLowerCase()
        const matchedTokens = queryTokens.filter(token => lowerSegment.includes(token))
        const score = matchedTokens.reduce((total, token) => total + Math.max(token.length, 3), 0)

        return {
          index,
          score,
        }
      })
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        return a.index - b.index
      })

    if (matchingSegments.length === 0) {
      return this.truncateAnswerSnippet(segments.slice(0, 2).join(' '), queryTokens)
    }

    const windows: string[] = []
    const seenIndexes = new Set<number>()
    const selectedMatches = matchingSegments.slice(0, 2).map(candidate => candidate.index)

    for (const matchIndex of selectedMatches) {
      let collectedLength = 0
      const end = Math.min(matchIndex + 5, segments.length)

      for (let index = matchIndex; index < end; index += 1) {
        if (seenIndexes.has(index)) {
          continue
        }

        seenIndexes.add(index)
        windows.push(segments[index])

        collectedLength += segments[index].length + 1
        if (collectedLength >= ANSWER_CONTEXT_CHARS) {
          break
        }
      }
    }

    return this.truncateAnswerSnippet(windows.join(' '), queryTokens)
  }

  private findFirstQueryTokenIndex(snippet: string, queryTokens: string[]): number {
    if (queryTokens.length === 0) {
      return -1
    }

    const lowerSnippet = snippet.toLowerCase()
    let firstIndex = Number.POSITIVE_INFINITY

    for (const token of queryTokens) {
      const index = lowerSnippet.indexOf(token)
      if (index >= 0 && index < firstIndex) {
        firstIndex = index
      }
    }

    return Number.isFinite(firstIndex) ? firstIndex : -1
  }

  private truncateAnswerSnippet(snippet: string, queryTokens: string[] = []): string {
    const normalizedSnippet = snippet.trim()
    if (normalizedSnippet.length <= ANSWER_CONTEXT_CHARS) {
      return normalizedSnippet
    }

    const matchIndex = this.findFirstQueryTokenIndex(normalizedSnippet, queryTokens)

    if (matchIndex >= 0) {
      const windowStart = Math.max(
        Math.min(
          matchIndex - Math.floor(ANSWER_CONTEXT_CHARS / 3),
          normalizedSnippet.length - ANSWER_CONTEXT_CHARS
        ),
        0
      )
      const windowEnd = Math.min(windowStart + ANSWER_CONTEXT_CHARS, normalizedSnippet.length)
      const compactSnippet = normalizedSnippet.slice(windowStart, windowEnd).trim()

      return `${windowStart > 0 ? '...' : ''}${compactSnippet}${windowEnd < normalizedSnippet.length ? '...' : ''}`
    }

    return `${normalizedSnippet.slice(0, ANSWER_CONTEXT_CHARS).trim()}...`
  }

  private getAnswerSourceKey(result: InternalSearchResult): string {
    const sourceKey = (
      result.documentId ||
      result.documentName ||
      result.url ||
      result.title ||
      result.memoryId
    ).trim()

    return sourceKey.toLowerCase()
  }

  private scoreAnswerCandidate(
    query: string,
    queryTokens: string[],
    result: InternalSearchResult
  ): number {
    const queryText = query.trim().toLowerCase()
    const labelText = `${result.documentName || ''} ${result.title || ''}`.toLowerCase()
    const previewText = `${result.contentPreview || ''} ${result.content || ''}`.toLowerCase()

    const labelHits = queryTokens.reduce((count, token) => {
      return count + (labelText.includes(token) ? 1 : 0)
    }, 0)
    const previewHits = queryTokens.reduce((count, token) => {
      return count + (previewText.includes(token) ? 1 : 0)
    }, 0)
    const exactQueryMatch = queryText.length > 0 && previewText.includes(queryText) ? 1 : 0

    return result.score * 1000 + labelHits * 120 + previewHits * 30 + exactQueryMatch * 180
  }

  private buildFallbackAnswer(
    error: unknown,
    results: Array<PublicSearchResult & { authorEmail?: string | null; capturedAt?: string | null }>
  ): { answer: string; citations: UnifiedSearchResult['citations'] } {
    const message =
      error instanceof Error && error.message
        ? error.message.toLowerCase()
        : String(error).toLowerCase()

    let reasonLine = 'The AI summary could not be generated right now.'
    if (message.includes('request too large') || message.includes('tokens per min')) {
      reasonLine =
        'The AI summary is temporarily unavailable because the retrieved context exceeded the provider limit.'
    } else if (isRateLimitError(error) || message.includes('rate limit')) {
      reasonLine = 'The AI summary is temporarily unavailable because the provider is rate-limited.'
    } else if (message.includes('timeout')) {
      reasonLine = 'The AI summary is temporarily unavailable because the provider timed out.'
    }

    const fallbackCitations = results.slice(0, MAX_FALLBACK_CITATIONS).map((result, index) => ({
      index: index + 1,
      documentName: result.documentName || result.title,
      pageNumber: result.pageNumber,
      memoryId: result.memoryId,
      url: result.url,
      sourceType: result.sourceType,
      authorEmail: result.authorEmail ?? null,
      capturedAt: result.capturedAt ?? null,
    }))

    const citationLine =
      fallbackCitations.length > 0
        ? `Top retrieved sources: ${fallbackCitations.map(citation => `[${citation.index}]`).join(' ')}`
        : 'Retrieved sources are still available below for direct review.'

    return {
      answer: `## Summary Unavailable\n\n- ${reasonLine}\n- Retrieved sources are still available below for direct review.\n- ${citationLine}`,
      citations: fallbackCitations,
    }
  }

  private resolveResultLimits(options: { requestedLimit?: number; hasUserContext: boolean }): {
    finalLimit: number
    organizationSearchLimit: number
    userSearchLimit: number
  } {
    const { requestedLimit, hasUserContext } = options
    const requested =
      typeof requestedLimit === 'number' && Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), SEARCH_CONSTANTS.MAX_LIMIT)
        : SEARCH_CONSTANTS.DEFAULT_LIMIT

    return {
      finalLimit: requested,
      organizationSearchLimit: SEARCH_CONSTANTS.FIRST_STAGE_K,
      userSearchLimit: hasUserContext ? SEARCH_CONSTANTS.USER_STAGE_K : 0,
    }
  }

  /**
   * Search across organization documents and memories
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const { organizationId, query, sourceTypes, limit, includeAnswer = true, userId } = options

    await ensureCollection()

    const { finalLimit, organizationSearchLimit, userSearchLimit } = this.resolveResultLimits({
      requestedLimit: limit,
      hasUserContext: Boolean(userId),
    })

    const cacheKey = searchCache.buildKey({
      organizationId,
      userId,
      query,
      sourceTypes,
      finalLimit,
    })

    const cachedHits = await searchCache.get(cacheKey)
    let hits: HybridSearchHit[]

    if (cachedHits) {
      hits = cachedHits
    } else {
      const queryEmbedding = await generateQueryEmbedding(query)

      hits = await hybridSearch({
        organizationId,
        userId,
        sourceTypes,
        query,
        queryEmbedding,
        organizationLimit: organizationSearchLimit,
        userLimit: userSearchLimit,
      })

      if (hits.length > 0) {
        await searchCache.set(cacheKey, hits)
      }
    }

    if (hits.length === 0) {
      return {
        results: [],
        totalResults: 0,
      }
    }

    const memoryScores = new Map<string, number>()
    for (const hit of hits) {
      const existingScore = memoryScores.get(hit.memoryId) || 0
      memoryScores.set(hit.memoryId, Math.max(existingScore, hit.score))
    }

    const memoryIds = Array.from(memoryScores.keys())

    // Fetch memories with document chunk info
    const memories = await prisma.memory.findMany({
      where: { id: { in: memoryIds } },
      select: {
        id: true,
        title: true,
        content: true,
        page_metadata: true,
        source_type: true,
        url: true,
        created_at: true,
        user: {
          select: {
            email: true,
          },
        },
        document_chunks: {
          take: 1,
          select: {
            chunk_index: true,
            page_number: true,
            document: {
              select: {
                id: true,
                original_name: true,
              },
            },
          },
        },
      },
    })

    const candidateResults: InternalSearchResult[] = memories
      .map(memory => {
        const chunk = memory.document_chunks[0]
        const score = memoryScores.get(memory.id) || 0
        const rawContent = memory.content || ''
        const pageMetadata = normalizePageMetadata(memory.page_metadata)
        const metadata = this.pickResultMetadata(pageMetadata)
        const representativeExcerpt =
          typeof pageMetadata.representativeExcerpt === 'string'
            ? pageMetadata.representativeExcerpt.replace(/\s+/g, ' ').trim()
            : ''
        const contentPreview = buildMemoryPreviewText({
          title: memory.title,
          content: rawContent,
          pageMetadata,
        })
        const retrievalText = buildMemoryRetrievalText({
          title: memory.title,
          content: rawContent,
          pageMetadata,
        })

        return {
          memoryId: memory.id,
          documentId: chunk?.document?.id,
          documentName: chunk?.document?.original_name,
          chunkIndex: chunk?.chunk_index,
          pageNumber: chunk?.page_number ?? undefined,
          highlightText: representativeExcerpt || rawContent || undefined,
          content: retrievalText,
          contentPreview:
            contentPreview || rawContent.substring(0, 300) + (rawContent.length > 300 ? '...' : ''),
          score,
          sourceType: memory.source_type || SourceType.EXTENSION,
          title: memory.title ?? undefined,
          url: memory.url ?? undefined,
          metadata,
          answerContent: rawContent,
          authorEmail: memory.user?.email ?? null,
          capturedAt: memory.created_at ? memory.created_at.toISOString() : null,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, SEARCH_CONSTANTS.RERANK_CANDIDATES)

    const rerankInputs = candidateResults.map(result => ({
      id: result.memoryId,
      text: [result.title, result.contentPreview, result.content]
        .filter(part => typeof part === 'string' && part.length > 0)
        .join('\n\n'),
    }))

    const rerankRanking = await rerankProvider.rerank({
      query,
      documents: rerankInputs,
      topN: finalLimit,
    })

    const rerankScoreById = new Map(rerankRanking.map(item => [item.id, item.score]))
    const internalResults: InternalSearchResult[] = candidateResults
      .map(result => {
        const newScore = rerankScoreById.get(result.memoryId)
        if (typeof newScore === 'number') {
          return { ...result, score: newScore }
        }
        return result
      })
      .filter(result => rerankScoreById.has(result.memoryId))
      .sort((a, b) => b.score - a.score)
      .slice(0, finalLimit)

    const results: PublicSearchResult[] = internalResults.map(result => {
      const { answerContent, authorEmail, capturedAt, ...publicResult } = result
      void answerContent
      void authorEmail
      void capturedAt
      return publicResult
    })

    // Generate AI answer asynchronously to prevent blocking search results
    let answerJobId: string | undefined

    if (includeAnswer && results.length > 0 && userId) {
      try {
        const answerResults = this.getAnswerCandidateResults(query, internalResults)
        // Create a job for answer generation (await to ensure it's stored before returning)
        const job = await createSearchJob(userId)
        answerJobId = job.id

        // Fire-and-forget: generate answer in background
        this.generateAnswerAsync(job.id, query, answerResults).catch(error => {
          logger.error('[unified-search] background answer generation failed', {
            error,
            jobId: job.id,
          })
        })
      } catch (error) {
        logger.error('[unified-search] failed to create answer job', { error })
        // Continue without answer job
      }
    } else if (includeAnswer && results.length > 0 && !userId) {
      logger.warn('[unified-search] skipping answer job because no user context was provided', {
        organizationId,
      })
    }

    logger.log('[unified-search] completed', {
      organizationId,
      queryLength: query.length,
      resultCount: results.length,
      answerResultCount: includeAnswer ? Math.min(results.length, MAX_ANSWER_RESULTS) : 0,
      answerJobId,
    })

    return {
      results,
      totalResults: results.length,
      answerJobId,
    }
  }

  /**
   * Generate an AI answer with citations
   */
  private async generateAnswer(
    query: string,
    results: InternalSearchResult[]
  ): Promise<{ answer: string; citations: UnifiedSearchResult['citations'] }> {
    const answerResults = this.getAnswerResults(query, results)

    // Build context with numbered references
    const contextParts = answerResults.map(({ sourceLabel, contextSnippet }) => {
      return `${sourceLabel}\n${contextSnippet}`
    })

    const context = contextParts.join('\n\n')

    const prompt = `You are a helpful assistant answering questions based on organizational documents and memories.

Context from documents:
${context}

User question: ${query}

Instructions:
1. Answer the question based on the provided context
2. Use citations like [1], [2] inline wherever you make a factual claim
3. If the context doesn't contain relevant information, say so clearly
4. Return GitHub-flavored Markdown
5. Prefer a short direct answer followed by bullets when multiple sources or points matter
6. Do not use tables or code fences
7. Be concise but thorough

Answer:`

    const response = await aiProvider.generateContent(prompt, true)

    // Extract citations from the answer
    const citationMatches = response.match(/\[(\d+)\]/g) || []
    const citationNumbers = [...new Set(citationMatches.map(m => parseInt(m.slice(1, -1))))]

    const citations = citationNumbers
      .filter(n => n > 0 && n <= answerResults.length)
      .map(n => ({
        index: n,
        documentName: answerResults[n - 1].result.documentName || answerResults[n - 1].result.title,
        pageNumber: answerResults[n - 1].result.pageNumber,
        memoryId: answerResults[n - 1].result.memoryId,
        url: answerResults[n - 1].result.url,
        sourceType: answerResults[n - 1].result.sourceType,
        authorEmail: answerResults[n - 1].result.authorEmail ?? null,
        capturedAt: answerResults[n - 1].result.capturedAt ?? null,
      }))

    return { answer: response, citations }
  }

  /**
   * Generate AI answer asynchronously and update the job when done
   */
  private async generateAnswerAsync(
    jobId: string,
    query: string,
    results: InternalSearchResult[]
  ): Promise<void> {
    logger.log('[unified-search] starting answer generation', {
      jobId,
      query: query.substring(0, 50),
    })
    const startTime = Date.now()

    try {
      const answerResult = await this.generateAnswer(query, results)
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      logger.log('[unified-search] answer generated', { jobId, elapsed: `${elapsed}s` })

      // Convert citations to job format
      const jobCitations = answerResult.citations?.map(c => ({
        label: c.index,
        memory_id: c.memoryId,
        title: c.documentName || null,
        url: c.url || null,
        source_type: c.sourceType || null,
        author_email: c.authorEmail ?? null,
        captured_at: c.capturedAt ?? null,
      }))

      await setSearchJobResult(jobId, {
        answer: answerResult.answer,
        citations: jobCitations,
        status: 'completed',
      })

      logger.log('[unified-search] answer generation completed', { jobId })
    } catch (error) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      logger.error('[unified-search] answer generation failed', {
        jobId,
        elapsed: `${elapsed}s`,
        error: error instanceof Error ? error.message : String(error),
      })
      const fallbackAnswer = this.buildFallbackAnswer(error, results)
      await setSearchJobResult(jobId, {
        answer: fallbackAnswer.answer,
        citations: fallbackAnswer.citations?.map(citation => ({
          label: citation.index,
          memory_id: citation.memoryId,
          title: citation.documentName || null,
          url: citation.url || null,
          source_type: citation.sourceType || null,
          author_email: citation.authorEmail ?? null,
          captured_at: citation.capturedAt ?? null,
        })),
        status: 'completed',
      })
    }
  }

  /**
   * Search only documents and integrations (not personal memories)
   */
  async searchDocuments(
    organizationId: string,
    query: string,
    limit: number = 20
  ): Promise<UnifiedSearchResult> {
    return this.search({
      organizationId,
      query,
      sourceTypes: [SourceType.DOCUMENT, SourceType.INTEGRATION],
      limit,
      includeAnswer: true,
    })
  }
}

export const unifiedSearchService = new UnifiedSearchService()
