import { searchHybrid } from '../../lib/qdrant.lib'
import { encodeSparse } from '../../lib/sparse-encoder.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { getActiveEmbeddingModelName } from '../ai/ai-config'
import { sha256Hex } from './query-processor.service'
import { DynamicSearchParams } from './query-processor.service'

type SearchScope = {
  userId?: string
  organizationId?: string
  memoryIds?: string[]
}

export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(v => {
      clearTimeout(t)
      resolve(v)
    }).catch(e => {
      clearTimeout(t)
      reject(e)
    })
  })
}

export async function generateQueryEmbedding(
  query: string,
  timeoutMs: number = 30000
): Promise<number[]> {
  if (!aiProvider.isInitialized) {
    logger.error('AI provider not initialized. Check OPENAI_API_KEY or provider configuration.')
    throw new Error('AI provider not configured. Set OPENAI_API_KEY or adjust provider settings.')
  }

  const embeddingResult = await withTimeout(aiProvider.generateEmbedding(query), timeoutMs)
  if (
    typeof embeddingResult === 'object' &&
    embeddingResult !== null &&
    'embedding' in embeddingResult
  ) {
    return (embeddingResult as { embedding: number[] }).embedding
  }
  return embeddingResult as number[]
}

export function getEmbeddingHash(embedding: number[]): string {
  const salt = process.env.SEARCH_EMBED_SALT || 'cognia'
  return sha256Hex(
    JSON.stringify({
      model: getActiveEmbeddingModelName(),
      values: embedding.slice(0, 64),
      salt,
    })
  )
}

export async function searchQdrant(
  embedding: number[],
  scope: SearchScope,
  searchParams: DynamicSearchParams,
  rawQuery?: string
): Promise<Array<{ score?: number; payload?: { memory_id?: string } }>> {
  const must: Array<{ key: string; match: { value?: string; any?: string[] } }> = []

  if (scope.userId) {
    must.push({ key: 'user_id', match: { value: scope.userId } })
  }

  if (scope.organizationId) {
    must.push({ key: 'organization_id', match: { value: scope.organizationId } })
  }

  if (scope.memoryIds && scope.memoryIds.length > 0) {
    must.push({ key: 'memory_id', match: { any: scope.memoryIds } })
  }

  const sparse = rawQuery ? encodeSparse(rawQuery) : null

  const qdrantSearchResult = await searchHybrid({
    dense: embedding,
    sparse,
    filter: { must },
    prefetchLimit: searchParams.qdrantLimit,
    limit: searchParams.qdrantLimit,
  })

  logger.log('[embedding-search] qdrant search completed', {
    resultCount: qdrantSearchResult.length,
    strategy: searchParams.searchStrategy,
    sparseEnabled: Boolean(sparse),
  })

  if (
    searchParams.searchStrategy === 'broad' &&
    qdrantSearchResult.length > searchParams.maxResults * 2
  ) {
    const highQualityResults = qdrantSearchResult.filter(r => (r.score || 0) > 0.3)
    if (highQualityResults.length >= searchParams.maxResults) {
      return highQualityResults
    }
  }

  return qdrantSearchResult
}
