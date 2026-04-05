import { qdrantClient, COLLECTION_NAME, ensureCollection } from '../../lib/qdrant.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { getActiveEmbeddingModelName } from '../ai/ai-config'
import { sha256Hex } from './query-processor.service'
import { DynamicSearchParams } from './query-processor.service'

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

  try {
    logger.log('[embedding-search] generating embedding', {
      ts: new Date().toISOString(),
      queryLength: query.length,
    })
    const embeddingResult = await withTimeout(aiProvider.generateEmbedding(query), timeoutMs)
    if (
      typeof embeddingResult === 'object' &&
      embeddingResult !== null &&
      'embedding' in embeddingResult
    ) {
      return (embeddingResult as { embedding: number[] }).embedding
    } else {
      return embeddingResult as number[]
    }
  } catch (error) {
    logger.warn('[embedding-search] embedding generation failed, using fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
    try {
      return aiProvider.generateFallbackEmbedding(query)
    } catch (fallbackError) {
      logger.error('[embedding-search] fallback embedding also failed', {
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })
      throw new Error('Failed to generate embedding')
    }
  }
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
  userMemoryIds: string[],
  searchParams: DynamicSearchParams
): Promise<Array<{ score?: number; payload?: { memory_id?: string } }>> {
  await ensureCollection()

  let qdrantSearchResult: Array<{ score?: number; payload?: { memory_id?: string } }> = []

  if (searchParams.searchStrategy === 'broad') {
    logger.log('[embedding-search] performing broad search', {
      ts: new Date().toISOString(),
      qdrantLimit: searchParams.qdrantLimit,
    })
    qdrantSearchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: embedding,
      filter: {
        must: [{ key: 'memory_id', match: { any: userMemoryIds } }],
      },
      limit: searchParams.qdrantLimit,
      with_payload: true,
      score_threshold: 0.1,
    })

    if (qdrantSearchResult.length > searchParams.maxResults * 2) {
      const highQualityResults = qdrantSearchResult.filter(r => (r.score || 0) > 0.3)
      if (highQualityResults.length >= searchParams.maxResults) {
        qdrantSearchResult = highQualityResults
        logger.log('[embedding-search] narrowed to high-quality results', {
          ts: new Date().toISOString(),
          filteredCount: qdrantSearchResult.length,
        })
      }
    }
  } else {
    logger.log('[embedding-search] searching qdrant', {
      ts: new Date().toISOString(),
      memoryCount: userMemoryIds.length,
      qdrantLimit: searchParams.qdrantLimit,
      strategy: searchParams.searchStrategy,
    })
    qdrantSearchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: embedding,
      filter: {
        must: [{ key: 'memory_id', match: { any: userMemoryIds } }],
      },
      limit: searchParams.qdrantLimit,
      with_payload: true,
    })
  }

  logger.log('[embedding-search] qdrant search completed', {
    ts: new Date().toISOString(),
    resultCount: qdrantSearchResult.length,
  })

  return qdrantSearchResult
}
