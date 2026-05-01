import { SourceType } from '@prisma/client'
import { searchHybrid, type QdrantPoint } from '../../lib/qdrant.lib'
import { encodeSparse } from '../../lib/sparse-encoder.lib'
import { logger } from '../../utils/core/logger.util'
import { SEARCH_CONSTANTS } from '../../utils/core/constants.util'

export interface HybridSearchHit {
  memoryId: string
  score: number
  rank: number
  payload?: Record<string, unknown>
}

interface FilterClause {
  must: Array<{ key: string; match: { value?: string; any?: string[] } }>
}

interface HybridSearchOptions {
  organizationId: string
  userId?: string
  sourceTypes?: SourceType[]
  query: string
  queryEmbedding: number[]
  organizationLimit: number
  userLimit: number
}

/**
 * Reciprocal Rank Fusion across two ranked lists (org + user).
 * Used after Qdrant returns per-tenant rankings to fuse the two scopes.
 */
function fuseRankings(rankings: HybridSearchHit[][], topN: number): HybridSearchHit[] {
  const k = SEARCH_CONSTANTS.RRF_K
  const scores = new Map<string, { score: number; payload?: Record<string, unknown> }>()

  for (const ranking of rankings) {
    ranking.forEach((hit, idx) => {
      const existing = scores.get(hit.memoryId)
      const contribution = 1 / (k + idx + 1)
      if (existing) {
        existing.score += contribution
      } else {
        scores.set(hit.memoryId, { score: contribution, payload: hit.payload })
      }
    })
  }

  return Array.from(scores.entries())
    .map(([memoryId, { score, payload }], idx) => ({
      memoryId,
      score,
      rank: idx + 1,
      payload,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((hit, idx) => ({ ...hit, rank: idx + 1 }))
}

function pointsToHits(points: QdrantPoint[]): HybridSearchHit[] {
  const seen = new Set<string>()
  const hits: HybridSearchHit[] = []
  let rank = 0
  for (const point of points) {
    const memoryId = (point.payload?.memory_id as string) || ''
    if (!memoryId || seen.has(memoryId)) continue
    seen.add(memoryId)
    rank += 1
    hits.push({
      memoryId,
      score: point.score ?? 0,
      rank,
      payload: (point.payload || {}) as Record<string, unknown>,
    })
  }
  return hits
}

/**
 * Hybrid (dense + sparse, RRF-fused) retrieval scoped to an organization,
 * with optional supplemental retrieval for the user's extension data.
 *
 * Returns deduplicated, fused hits ordered by score.
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchHit[]> {
  const startTs = Date.now()
  const sparseQuery = encodeSparse(options.query)

  const orgFilter: FilterClause = {
    must: [{ key: 'organization_id', match: { value: options.organizationId } }],
  }
  if (options.sourceTypes && options.sourceTypes.length > 0) {
    orgFilter.must.push({
      key: 'source_type',
      match: { any: options.sourceTypes as string[] },
    })
  }

  const orgPromise = searchHybrid({
    dense: options.queryEmbedding,
    sparse: sparseQuery,
    filter: orgFilter,
    prefetchLimit: options.organizationLimit,
    limit: options.organizationLimit,
  })

  const userPromise: Promise<QdrantPoint[]> =
    options.userId && options.userLimit > 0
      ? searchHybrid({
          dense: options.queryEmbedding,
          sparse: sparseQuery,
          filter: {
            must: [
              { key: 'user_id', match: { value: options.userId } },
              { key: 'source_type', match: { any: [SourceType.EXTENSION] } },
            ],
          },
          prefetchLimit: options.userLimit,
          limit: options.userLimit,
        })
      : Promise.resolve([])

  const [orgPoints, userPoints] = await Promise.all([orgPromise, userPromise])

  const orgHits = pointsToHits(orgPoints)
  const userHits = pointsToHits(userPoints)

  const fused =
    orgHits.length > 0 && userHits.length > 0
      ? fuseRankings([orgHits, userHits], options.organizationLimit + options.userLimit)
      : [...orgHits, ...userHits].sort((a, b) => b.score - a.score)

  logger.log('[hybrid-search] completed', {
    organizationId: options.organizationId,
    durationMs: Date.now() - startTs,
    orgCandidates: orgHits.length,
    userCandidates: userHits.length,
    fused: fused.length,
    sparseEnabled: Boolean(sparseQuery),
  })

  return fused
}
