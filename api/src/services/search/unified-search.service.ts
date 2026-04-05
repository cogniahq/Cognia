import { prisma } from '../../lib/prisma.lib'
import { qdrantClient, COLLECTION_NAME, ensureCollection } from '../../lib/qdrant.lib'
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
import { tokenizeQuery } from './query-processor.service'

const ANSWER_CONTEXT_CHARS = 1400
const ANSWER_CONTEXT_LEAD_CHARS = 220

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
    content: string
    contentPreview: string
    score: number
    sourceType: SourceType
    title?: string
    url?: string
  }>
  answer?: string
  citations?: Array<{
    index: number
    documentName?: string
    pageNumber?: number
    memoryId: string
    url?: string
    sourceType?: SourceType
  }>
  totalResults: number
  answerJobId?: string // Job ID for async answer generation
}

export class UnifiedSearchService {
  private buildAnswerContextSnippet(
    query: string,
    result: UnifiedSearchResult['results'][number]
  ): string {
    const normalizedContent = result.content.replace(/\s+/g, ' ').trim()
    const normalizedPreview = result.contentPreview.replace(/\s+/g, ' ').trim()

    if (!normalizedContent) {
      return normalizedPreview
    }

    const queryTokens = tokenizeQuery(query)
    const lowerContent = normalizedContent.toLowerCase()
    const firstMatchIndex = queryTokens.reduce((closestIndex, token) => {
      const matchIndex = lowerContent.indexOf(token)
      if (matchIndex === -1) {
        return closestIndex
      }

      if (closestIndex === -1) {
        return matchIndex
      }

      return Math.min(closestIndex, matchIndex)
    }, -1)

    if (firstMatchIndex === -1) {
      if (normalizedContent.length <= ANSWER_CONTEXT_CHARS) {
        return normalizedContent
      }

      return `${normalizedContent.slice(0, ANSWER_CONTEXT_CHARS).trim()}...`
    }

    const start = Math.max(firstMatchIndex - ANSWER_CONTEXT_LEAD_CHARS, 0)
    const end = Math.min(start + ANSWER_CONTEXT_CHARS, normalizedContent.length)
    const excerpt = normalizedContent.slice(start, end).trim()

    return `${start > 0 ? '...' : ''}${excerpt}${end < normalizedContent.length ? '...' : ''}`
  }

  private async resolveResultLimits(options: {
    organizationId: string
    sourceTypes?: SourceType[]
    requestedLimit?: number
    userId?: string
  }): Promise<{
    finalLimit: number
    organizationSearchLimit: number
    userSearchLimit: number
  }> {
    const { organizationId, sourceTypes, requestedLimit, userId } = options

    if (typeof requestedLimit === 'number' && Number.isFinite(requestedLimit) && requestedLimit > 0) {
      const finalLimit = Math.floor(requestedLimit)
      return {
        finalLimit,
        organizationSearchLimit: Math.max(finalLimit * 2, 1),
        userSearchLimit: Math.max(Math.ceil(finalLimit / 2), 1),
      }
    }

    const [organizationResultCount, userResultCount] = await Promise.all([
      prisma.memory.count({
        where: {
          organization_id: organizationId,
          ...(sourceTypes && sourceTypes.length > 0 ? { source_type: { in: sourceTypes } } : {}),
        },
      }),
      userId
        ? prisma.memory.count({
            where: {
              user_id: userId,
              source_type: SourceType.EXTENSION,
            },
          })
        : Promise.resolve(0),
    ])

    return {
      finalLimit: Math.max(organizationResultCount + userResultCount, 1),
      organizationSearchLimit: Math.max(organizationResultCount, 1),
      userSearchLimit: Math.max(userResultCount, 1),
    }
  }

  /**
   * Search across organization documents and memories
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const { organizationId, query, sourceTypes, limit, includeAnswer = true, userId } = options

    await ensureCollection()

    const queryEmbedding = await generateQueryEmbedding(query)
    const {
      finalLimit,
      organizationSearchLimit,
      userSearchLimit,
    } = await this.resolveResultLimits({
      organizationId,
      sourceTypes,
      requestedLimit: limit,
      userId,
    })

    // Build Qdrant filter for organization content
    const orgFilter: {
      must: Array<{ key: string; match: { value?: string; any?: string[] } }>
    } = {
      must: [{ key: 'organization_id', match: { value: organizationId } }],
    }

    if (sourceTypes && sourceTypes.length > 0) {
      orgFilter.must.push({
        key: 'source_type',
        match: { any: sourceTypes },
      })
    }

    // Search organization content
    const orgSearchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: orgFilter,
      limit: organizationSearchLimit,
      with_payload: true,
      score_threshold: 0.2,
    })

    // If userId provided, also search user's extension data
    let userSearchResult: typeof orgSearchResult = []
    if (userId) {
      const userFilter: {
        must: Array<{ key: string; match: { value?: string; any?: string[] } }>
      } = {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'source_type', match: { any: [SourceType.EXTENSION] } },
        ],
      }

      userSearchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        filter: userFilter,
        limit: userSearchLimit,
        with_payload: true,
        score_threshold: 0.25, // Slightly higher threshold for user content
      })
    }

    // Combine results
    const searchResult = [...orgSearchResult, ...userSearchResult]

    if (!searchResult || searchResult.length === 0) {
      return {
        results: [],
        totalResults: 0,
      }
    }

    // Extract unique memory IDs
    const memoryScores = new Map<string, number>()
    for (const result of searchResult) {
      const memoryId = result.payload?.memory_id as string
      if (memoryId) {
        const existingScore = memoryScores.get(memoryId) || 0
        memoryScores.set(memoryId, Math.max(existingScore, result.score || 0))
      }
    }

    const memoryIds = Array.from(memoryScores.keys())

    // Fetch memories with document chunk info
    const memories = await prisma.memory.findMany({
      where: { id: { in: memoryIds } },
      include: {
        document_chunks: {
          include: {
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

    // Build results with document info
    const results = memories
      .map(memory => {
        const chunk = memory.document_chunks[0]
        const score = memoryScores.get(memory.id) || 0
        const pageMetadata = normalizePageMetadata(memory.page_metadata)
        const contentPreview = buildMemoryPreviewText({
          title: memory.title,
          content: memory.content,
          pageMetadata,
        })
        const retrievalText = buildMemoryRetrievalText({
          title: memory.title,
          content: memory.content,
          pageMetadata,
        })

        return {
          memoryId: memory.id,
          documentId: chunk?.document?.id,
          documentName: chunk?.document?.original_name,
          chunkIndex: chunk?.chunk_index,
          pageNumber: chunk?.page_number ?? undefined,
          content: retrievalText,
          contentPreview:
            contentPreview || memory.content.substring(0, 300) + (memory.content.length > 300 ? '...' : ''),
          score,
          sourceType: memory.source_type || SourceType.EXTENSION,
          title: memory.title ?? undefined,
          url: memory.url ?? undefined,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, finalLimit)

    // Group by document for better context
    const documentGroups = new Map<string, typeof results>()
    for (const result of results) {
      const key = result.documentId || result.memoryId
      if (!documentGroups.has(key)) {
        documentGroups.set(key, [])
      }
      documentGroups.get(key)!.push(result)
    }

    // Generate AI answer asynchronously to prevent blocking search results
    let answerJobId: string | undefined

    if (includeAnswer && results.length > 0 && userId) {
      try {
        // Create a job for answer generation (await to ensure it's stored before returning)
        const job = await createSearchJob(userId)
        answerJobId = job.id

        // Fire-and-forget: generate answer in background
        this.generateAnswerAsync(job.id, query, results).catch(error => {
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
    results: UnifiedSearchResult['results']
  ): Promise<{ answer: string; citations: UnifiedSearchResult['citations'] }> {
    // Build context with numbered references
    const contextParts = results.map((result, index) => {
      const source = result.documentName
        ? `[${index + 1}] Document: ${result.documentName}${result.pageNumber ? ` (Page ${result.pageNumber})` : ''}`
        : `[${index + 1}] ${result.title || 'Memory'}`
      return `${source}\n${this.buildAnswerContextSnippet(query, result)}`
    })

    const context = contextParts.join('\n\n')

    const prompt = `You are a helpful assistant answering questions based on organizational documents and memories.

Context from documents:
${context}

User question: ${query}

Instructions:
1. Answer the question based on the provided context
2. Use citations like [1], [2] to reference sources
3. If the context doesn't contain relevant information, say so
4. Be concise but thorough
5. Return plain text only, no markdown formatting

Answer:`

    const response = await aiProvider.generateContent(prompt)

    // Extract citations from the answer
    const citationMatches = response.match(/\[(\d+)\]/g) || []
    const citationNumbers = [...new Set(citationMatches.map(m => parseInt(m.slice(1, -1))))]

    const citations = citationNumbers
      .filter(n => n > 0 && n <= results.length)
      .map(n => ({
        index: n,
        documentName: results[n - 1].documentName || results[n - 1].title,
        pageNumber: results[n - 1].pageNumber,
        memoryId: results[n - 1].memoryId,
        url: results[n - 1].url,
        sourceType: results[n - 1].sourceType,
      }))

    return { answer: response, citations }
  }

  /**
   * Generate AI answer asynchronously and update the job when done
   */
  private async generateAnswerAsync(
    jobId: string,
    query: string,
    results: UnifiedSearchResult['results']
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
      await setSearchJobResult(jobId, {
        status: 'failed',
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
