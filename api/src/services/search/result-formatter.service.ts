import { MemoryType } from '@prisma/client'
import { buildContentPreview } from '../../utils/text/text.util'
import { calculateSimilarity, normalizeText, normalizeUrl } from '../../utils/text/text.util'
import { DynamicSearchParams, QueryAnalysis } from './query-processor.service'
import {
  applyPolicyScore,
  filterMemoriesByPolicy,
  type RetrievalPolicy,
} from './retrieval-policy.service'
import { rerankingService } from './reranking.service'
import { logger } from '../../utils/core/logger.util'
import type { SearchResult } from '../../types/search.types'
import {
  buildMemoryPreviewText,
  buildMemoryRetrievalText,
  normalizePageMetadata,
} from '../memory/memory-structure.service'

export type { SearchResult }

type MemoryRow = {
  id: string
  title: string | null
  url: string | null
  timestamp: bigint | number | null
  content: string | null
  content_preview: string
  score: number
  memory_type: MemoryType | null
  importance_score: number | null
  source: string | null
  created_at: Date
  page_metadata: Record<string, unknown>
}

type ScoredRow = MemoryRow & {
  semantic_score: number
  keyword_score: number
  coverage_ratio: number
  final_score: number
}

const MS_IN_DAY = 1000 * 60 * 60 * 24
const EXTENSION_SEARCH_DUPLICATE_SIMILARITY = 0.55

type DeduplicatedSearchRow = {
  id: string
  title: string | null
  url: string | null
  content: string | null
  content_preview: string
  source: string | null
  created_at: Date
  score: number
  final_score?: number
}

function isExtensionSearchRow(row: Pick<DeduplicatedSearchRow, 'source'>): boolean {
  return normalizeText(row.source || '') === 'extension'
}

function buildSearchDeduplicationKey(
  row: Pick<DeduplicatedSearchRow, 'source' | 'title' | 'url'>
): string | null {
  if (!isExtensionSearchRow(row) || !row.title || !row.url) {
    return null
  }

  const normalizedTitle = normalizeText(row.title)
  const normalizedUrl = normalizeUrl(row.url)

  if (!normalizedTitle || !normalizedUrl) {
    return null
  }

  return `${normalizedTitle}::${normalizedUrl}`
}

function getSearchRowRankingScore(row: DeduplicatedSearchRow): number {
  return typeof row.final_score === 'number' ? row.final_score : row.score
}

function getSearchRowContent(row: DeduplicatedSearchRow): string {
  return normalizeText(row.content || row.content_preview || '')
}

export function deduplicateSearchRows<T extends DeduplicatedSearchRow>(rows: T[]): T[] {
  const deduplicated: T[] = []
  const keptRowsByKey = new Map<string, T[]>()

  const rankedRows = [...rows].sort((left, right) => {
    const scoreDelta = getSearchRowRankingScore(right) - getSearchRowRankingScore(left)
    if (Math.abs(scoreDelta) > 0.0001) {
      return scoreDelta
    }

    return right.created_at.getTime() - left.created_at.getTime()
  })

  for (const row of rankedRows) {
    const deduplicationKey = buildSearchDeduplicationKey(row)
    if (!deduplicationKey) {
      deduplicated.push(row)
      continue
    }

    const keptRows = keptRowsByKey.get(deduplicationKey) || []
    const rowContent = getSearchRowContent(row)
    const isDuplicate = keptRows.some(existingRow => {
      const similarity = calculateSimilarity(rowContent, getSearchRowContent(existingRow))
      return similarity >= EXTENSION_SEARCH_DUPLICATE_SIMILARITY
    })

    if (isDuplicate) {
      continue
    }

    keptRows.push(row)
    keptRowsByKey.set(deduplicationKey, keptRows)
    deduplicated.push(row)
  }

  return deduplicated
}

export function scoreSearchResults(
  rows: MemoryRow[],
  queryTokens: string[],
  searchParams: DynamicSearchParams,
  queryAnalysis: QueryAnalysis
): ScoredRow[] {
  const scoredRows = rows.map(row => {
    const title = (row.title || '').toLowerCase()
    const preview = (row.content_preview || '').toLowerCase()
    const content = (row.content || '').toLowerCase()

    let keywordScore = 0
    let matchedTokens = 0

    for (const token of queryTokens) {
      const tokenRegex = new RegExp(`\\b${token}\\b`, 'gi')

      if (tokenRegex.test(title)) {
        keywordScore += 0.5
        matchedTokens++
      }

      if (tokenRegex.test(preview)) {
        keywordScore += 0.3
        matchedTokens++
      }

      if (tokenRegex.test(content)) {
        keywordScore += 0.2
        matchedTokens++
      }
    }

    if (queryTokens.length > 0) {
      keywordScore = keywordScore / queryTokens.length
    }

    const coverageRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0

    const semanticScore = row.score
    const hybridScore = semanticScore * 0.6 + keywordScore * 0.4

    const boostedScore = hybridScore * (1 + coverageRatio * 0.3)

    return {
      ...row,
      semantic_score: semanticScore,
      keyword_score: keywordScore,
      coverage_ratio: coverageRatio,
      final_score: boostedScore,
    }
  })

  return scoredRows
    .filter(row => {
      const passesSemantic = row.semantic_score >= searchParams.semanticThreshold
      const passesKeyword = row.keyword_score >= searchParams.keywordThreshold
      const passesCoverage = row.coverage_ratio >= searchParams.coverageThreshold
      const passesMinScore = row.final_score >= searchParams.minScore

      return (passesSemantic || passesKeyword || passesCoverage) && passesMinScore
    })
    .sort((a, b) => {
      if (Math.abs(a.final_score - b.final_score) < 0.01) {
        if (queryAnalysis.estimatedMemoryAge === 'old') {
          return Number(b.timestamp) - Number(a.timestamp)
        }
      }
      return b.final_score - a.final_score
    })
    .slice(0, searchParams.maxResults)
}

export function applyPolicyScoring(
  rows: ScoredRow[],
  retrievalPolicy: RetrievalPolicy
): ScoredRow[] {
  const policyScoredRows = filterMemoriesByPolicy(
    rows.map(row => {
      const rowDate =
        row.created_at instanceof Date
          ? row.created_at
          : row.timestamp
            ? new Date(Number(row.timestamp) * 1000)
            : new Date()
      const recencyDays = (Date.now() - rowDate.getTime()) / MS_IN_DAY
      const policyScore = applyPolicyScore(
        {
          semanticScore: row.semantic_score,
          keywordScore: row.keyword_score,
          importanceScore: row.importance_score ?? 0,
          recencyDays,
        },
        retrievalPolicy
      )
      return {
        ...row,
        final_score: policyScore,
      }
    }),
    retrievalPolicy
  )
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, retrievalPolicy.maxResults)

  return policyScoredRows
}

export async function applyReranking(
  rows: ScoredRow[],
  query: string,
  userId: string,
  contextOnly: boolean,
  embeddingOnly: boolean,
  shouldGenerateAnswer: boolean
): Promise<ScoredRow[]> {
  const shouldRerank =
    rows.length >= 5 && rows.length <= 20 && !contextOnly && !embeddingOnly && !shouldGenerateAnswer

  if (!shouldRerank) {
    return rows
  }

  try {
    logger.log('[result-formatter] Applying reranking', {
      ts: new Date().toISOString(),
      userId,
      candidateCount: rows.length,
    })

    const candidates = rows.map(row => ({
      id: row.id,
      title: row.title,
      preview: row.content_preview,
      content: row.content,
      score: row.final_score || row.score,
    }))

    const reranked = await rerankingService.rerankMemories(query, candidates, userId)

    const rerankMap = new Map(reranked.map(r => [r.id, r]))

    const finalRows = rows
      .map(row => {
        const rerankResult = rerankMap.get(row.id)
        if (rerankResult) {
          const combinedScore = (row.final_score || row.score) * 0.7 + rerankResult.score * 0.3
          return {
            ...row,
            final_score: combinedScore,
            rerank_rank: rerankResult.rank,
            rerank_reasoning: rerankResult.reasoning,
          } as ScoredRow & { rerank_rank?: number; rerank_reasoning?: string }
        }
        return row
      })
      .sort((a, b) => b.final_score - a.final_score)

    logger.log('[result-formatter] Reranking completed', {
      ts: new Date().toISOString(),
      userId,
      rerankedCount: reranked.length,
    })

    return finalRows
  } catch (rerankError) {
    logger.warn('[result-formatter] Reranking failed, using original order', {
      error: rerankError instanceof Error ? rerankError.message : String(rerankError),
    })
    return rows
  }
}

export function formatSearchResults(
  rows: ScoredRow[],
  relatedMemoriesMap: Map<string, string[]>
): SearchResult[] {
  return rows.map(r => ({
    memory_id: r.id,
    title: r.title,
    content_preview: r.content_preview,
    url: r.url,
    timestamp: Number(r.timestamp),
    related_memories: relatedMemoriesMap.get(r.id) || [],
    score: r.final_score,
    memory_type: r.memory_type ?? null,
    importance_score: r.importance_score,
    source: r.source,
  }))
}

export function buildMemoryRows(
  memories: Array<{
    id: string
    title: string | null
    url: string | null
    timestamp: bigint | number | null
    content: string | null
    canonical_text: string | null
    page_metadata?: unknown | null
    memory_type: MemoryType | null
    importance_score: number | null
    source: string | null
    created_at: Date
  }>,
  scoreMap: Map<string, number>
): MemoryRow[] {
  return Array.from(scoreMap.entries())
    .map(([memoryId, semanticScore]) => {
      const memory = memories.find(m => m.id === memoryId)
      if (!memory) return null
      const pageMetadata = normalizePageMetadata(memory.page_metadata)
      const previewSource = buildMemoryPreviewText({
        title: memory.title,
        content: memory.content || memory.canonical_text || '',
        pageMetadata,
      })
      const retrievalText = buildMemoryRetrievalText({
        title: memory.title,
        content: memory.content || memory.canonical_text || '',
        pageMetadata,
      })
      return {
        id: memory.id,
        title: memory.title,
        url: memory.url,
        timestamp: memory.timestamp,
        content: retrievalText,
        content_preview: buildContentPreview(previewSource),
        score: semanticScore,
        memory_type: memory.memory_type,
        importance_score: memory.importance_score,
        source: memory.source,
        created_at: memory.created_at,
        page_metadata: pageMetadata,
      }
    })
    .filter((row): row is MemoryRow => row !== null)
}
