import { SourceType } from '@prisma/client'

import { prisma } from '../../lib/prisma.lib'
import { COLLECTION_NAME, ensureCollection, qdrantClient } from '../../lib/qdrant.lib'
import { aiProvider } from '../ai/ai-provider.service'
import type {
  PlatformCitation,
  PlatformDocumentMetadata,
  PlatformSearchRequest,
  PlatformSearchResult,
} from '../../types/platform.types'

const PLATFORM_SOURCE_TYPES: SourceType[] = [
  SourceType.DOCUMENT,
  SourceType.INTEGRATION,
  SourceType.API,
]

function normalizeMetadata(value: unknown): PlatformDocumentMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as PlatformDocumentMetadata
}

function normalizeMatterIds(metadata: PlatformDocumentMetadata | null): string[] {
  if (!metadata) {
    return []
  }

  if (Array.isArray(metadata.matterIds)) {
    return metadata.matterIds.filter((value): value is string => typeof value === 'string')
  }

  if (typeof metadata.matterId === 'string') {
    return [metadata.matterId]
  }

  return []
}

export class PlatformSearchService {
  async query(
    organizationId: string,
    request: PlatformSearchRequest
  ): Promise<PlatformSearchResult> {
    if (!request.allowedMatterIds.length) {
      throw new Error('allowedMatterIds must not be empty')
    }

    if (request.mode === 'matter' && !request.currentMatterId) {
      throw new Error('currentMatterId is required for matter mode')
    }

    await ensureCollection()

    const embeddingResult = await aiProvider.generateEmbedding(request.query)
    const queryEmbedding =
      typeof embeddingResult === 'object' && 'embedding' in embeddingResult
        ? (embeddingResult as { embedding: number[] }).embedding
        : (embeddingResult as number[])

    const excludedSourceTypes = new Set(request.excludeSourceTypes || [])
    excludedSourceTypes.add(SourceType.EXTENSION)
    const includedSourceTypes = PLATFORM_SOURCE_TYPES.filter(
      sourceType => !excludedSourceTypes.has(sourceType)
    )

    const rawResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: {
        must: [
          { key: 'organization_id', match: { value: organizationId } },
          { key: 'source_type', match: { any: includedSourceTypes } },
        ],
      },
      limit: Math.max((request.limit || 10) * 4, 20),
      with_payload: true,
      score_threshold: 0.2,
    })

    const memoryScores = new Map<string, number>()
    for (const result of rawResults) {
      const memoryId = result.payload?.memory_id as string | undefined
      if (!memoryId) {
        continue
      }

      const currentScore = memoryScores.get(memoryId) || 0
      memoryScores.set(memoryId, Math.max(currentScore, result.score || 0))
    }

    const memories = await prisma.memory.findMany({
      where: {
        id: {
          in: Array.from(memoryScores.keys()),
        },
        organization_id: organizationId,
      },
      include: {
        document_chunks: {
          include: {
            document: {
              select: {
                id: true,
                original_name: true,
                metadata: true,
              },
            },
          },
          take: 1,
        },
      },
    })

    const allowedMatterIds = new Set(request.allowedMatterIds)
    const filteredResults = memories
      .map(memory => {
        const chunk = memory.document_chunks[0]
        const metadata =
          normalizeMetadata(memory.page_metadata) ||
          normalizeMetadata(chunk?.document?.metadata) ||
          null
        const matterIds = normalizeMatterIds(metadata)
        const score = memoryScores.get(memory.id) || 0

        return {
          memoryId: memory.id,
          documentId: chunk?.document?.id,
          documentName: chunk?.document?.original_name,
          pageNumber: chunk?.page_number ?? undefined,
          score,
          title: memory.title ?? undefined,
          url: memory.url ?? undefined,
          sourceType: memory.source_type || SourceType.DOCUMENT,
          contentPreview: memory.content.slice(0, 320) + (memory.content.length > 320 ? '...' : ''),
          metadata,
          matterIds,
        }
      })
      .filter(result => {
        if (result.matterIds.length === 0) {
          return false
        }

        if (request.mode === 'matter') {
          return result.matterIds.includes(request.currentMatterId!)
        }

        return result.matterIds.some(matterId => allowedMatterIds.has(matterId))
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit || 10)

    let answer: string | undefined
    let citations: PlatformCitation[] | undefined

    if (request.includeAnswer !== false && filteredResults.length > 0) {
      const answerResult = await this.generateAnswer(request.query, filteredResults)
      answer = answerResult.answer
      citations = answerResult.citations
    }

    return {
      query: request.query,
      mode: request.mode,
      totalResults: filteredResults.length,
      answer,
      citations: request.includeCitations === false ? undefined : citations,
      results: filteredResults.map(result => ({
        memoryId: result.memoryId,
        documentId: result.documentId,
        documentName: result.documentName,
        pageNumber: result.pageNumber,
        score: result.score,
        title: result.title,
        url: result.url,
        sourceType: result.sourceType,
        contentPreview: result.contentPreview,
        metadata: result.metadata,
      })),
    }
  }

  private async generateAnswer(
    query: string,
    results: Array<{
      memoryId: string
      documentId?: string
      documentName?: string
      pageNumber?: number
      title?: string
      url?: string
      sourceType: string
      contentPreview: string
    }>
  ): Promise<{ answer: string; citations: PlatformCitation[] }> {
    const context = results
      .map((result, index) => {
        const label = result.documentName || result.title || `Source ${index + 1}`
        const pageInfo = result.pageNumber ? ` (Page ${result.pageNumber})` : ''
        return `[${index + 1}] ${label}${pageInfo}\n${result.contentPreview}`
      })
      .join('\n\n')

    const prompt = `You are assisting a legal workflow with source-grounded drafting support.

Context:
${context}

Question:
${query}

Instructions:
1. Answer only from the provided context.
2. Use citations like [1], [2] inline.
3. If the context is insufficient, say so clearly.
4. Return plain text only.
`

    const answer = await aiProvider.generateContent(prompt)
    const citationNumbers = [
      ...new Set((answer.match(/\[(\d+)\]/g) || []).map(token => Number(token.slice(1, -1)))),
    ]

    return {
      answer,
      citations: citationNumbers
        .filter(number => number > 0 && number <= results.length)
        .map(number => ({
          index: number,
          memoryId: results[number - 1].memoryId,
          documentId: results[number - 1].documentId,
          documentName: results[number - 1].documentName,
          pageNumber: results[number - 1].pageNumber,
          sourceType: results[number - 1].sourceType,
          title: results[number - 1].title,
          url: results[number - 1].url,
        })),
    }
  }
}

export const platformSearchService = new PlatformSearchService()
