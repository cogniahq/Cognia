import { prisma } from '../../lib/prisma.lib'
import { qdrantClient, COLLECTION_NAME, ensureCollection } from '../../lib/qdrant.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { SourceType } from '@prisma/client'

export interface UnifiedSearchOptions {
  organizationId: string
  query: string
  sourceTypes?: SourceType[]
  limit?: number
  includeAnswer?: boolean
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
  }>
  totalResults: number
}

export class UnifiedSearchService {
  /**
   * Search across organization documents and memories
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const { organizationId, query, sourceTypes, limit = 20, includeAnswer = true } = options

    await ensureCollection()

    // Generate query embedding
    let queryEmbedding: number[]
    try {
      const embeddingResult = await aiProvider.generateEmbedding(query)
      queryEmbedding =
        typeof embeddingResult === 'object' && 'embedding' in embeddingResult
          ? (embeddingResult as { embedding: number[] }).embedding
          : (embeddingResult as number[])
    } catch (error) {
      logger.error('[unified-search] embedding generation failed', { error })
      throw new Error('Failed to process search query')
    }

    // Build Qdrant filter
    const filter: {
      must: Array<{ key: string; match: { value?: string; any?: string[] } }>
    } = {
      must: [{ key: 'organization_id', match: { value: organizationId } }],
    }

    if (sourceTypes && sourceTypes.length > 0) {
      filter.must.push({
        key: 'source_type',
        match: { any: sourceTypes },
      })
    }

    // Search Qdrant
    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter,
      limit: limit * 2, // Get more for deduplication
      with_payload: true,
      score_threshold: 0.2,
    })

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

        return {
          memoryId: memory.id,
          documentId: chunk?.document?.id,
          documentName: chunk?.document?.original_name,
          chunkIndex: chunk?.chunk_index,
          pageNumber: chunk?.page_number ?? undefined,
          content: memory.content,
          contentPreview: memory.content.substring(0, 300) + (memory.content.length > 300 ? '...' : ''),
          score,
          sourceType: memory.source_type || SourceType.EXTENSION,
          title: memory.title ?? undefined,
          url: memory.url ?? undefined,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    // Group by document for better context
    const documentGroups = new Map<string, typeof results>()
    for (const result of results) {
      const key = result.documentId || result.memoryId
      if (!documentGroups.has(key)) {
        documentGroups.set(key, [])
      }
      documentGroups.get(key)!.push(result)
    }

    // Generate AI answer if requested
    let answer: string | undefined
    let citations: UnifiedSearchResult['citations']

    if (includeAnswer && results.length > 0) {
      try {
        const answerResult = await this.generateAnswer(query, results.slice(0, 10))
        answer = answerResult.answer
        citations = answerResult.citations
      } catch (error) {
        logger.error('[unified-search] answer generation failed', { error })
        // Continue without answer
      }
    }

    logger.log('[unified-search] completed', {
      organizationId,
      queryLength: query.length,
      resultCount: results.length,
      hasAnswer: !!answer,
    })

    return {
      results,
      answer,
      citations,
      totalResults: results.length,
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
      return `${source}\n${result.contentPreview}`
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
        documentName: results[n - 1].documentName,
        pageNumber: results[n - 1].pageNumber,
        memoryId: results[n - 1].memoryId,
      }))

    return { answer: response, citations }
  }

  /**
   * Search only documents (not personal memories)
   */
  async searchDocuments(
    organizationId: string,
    query: string,
    limit: number = 20
  ): Promise<UnifiedSearchResult> {
    return this.search({
      organizationId,
      query,
      sourceTypes: [SourceType.DOCUMENT],
      limit,
      includeAnswer: true,
    })
  }
}

export const unifiedSearchService = new UnifiedSearchService()
