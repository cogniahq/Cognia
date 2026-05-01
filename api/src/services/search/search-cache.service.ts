import { createHash } from 'crypto'
import type { SourceType } from '@prisma/client'
import { getRedisClient, scanKeys } from '../../lib/redis.lib'
import { logger } from '../../utils/core/logger.util'
import { SEARCH_CONSTANTS } from '../../utils/core/constants.util'
import type { HybridSearchHit } from './hybrid-search.service'

const CACHE_PREFIX = 'search_cache:v1'

interface CacheKeyInput {
  organizationId: string
  userId?: string
  query: string
  sourceTypes?: SourceType[]
  finalLimit: number
}

function hashCanonical(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 24)
}

function buildKey(input: CacheKeyInput): string {
  const queryNorm = input.query.trim().toLowerCase().replace(/\s+/g, ' ')

  const filters = {
    sourceTypes: [...(input.sourceTypes || [])].sort(),
    finalLimit: input.finalLimit,
  }
  const queryHash = hashCanonical(queryNorm)
  const filterHash = hashCanonical(filters)
  const userScope = input.userId ? `u:${input.userId}` : 'org-only'
  return `${CACHE_PREFIX}:${input.organizationId}:${userScope}:${queryHash}:${filterHash}`
}

class SearchCache {
  buildKey(input: CacheKeyInput): string {
    return buildKey(input)
  }

  async get(key: string): Promise<HybridSearchHit[] | null> {
    try {
      const redis = getRedisClient()
      const raw = await redis.get(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as HybridSearchHit[]
      logger.log('[search-cache] hit', { key })
      return parsed
    } catch (error) {
      logger.warn('[search-cache] get failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async set(key: string, hits: HybridSearchHit[]): Promise<void> {
    try {
      const redis = getRedisClient()
      await redis.setex(key, SEARCH_CONSTANTS.QUERY_CACHE_TTL_SECONDS, JSON.stringify(hits))
    } catch (error) {
      logger.warn('[search-cache] set failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Invalidate all cached results for an organization. Called on memory
   * ingest / update / delete to keep the cache truthful.
   */
  async invalidateOrganization(organizationId: string): Promise<void> {
    try {
      const redis = getRedisClient()
      const pattern = `${CACHE_PREFIX}:${organizationId}:*`
      const keys = await scanKeys(redis, pattern, 5000)
      if (keys.length > 0) {
        await redis.del(...keys)
        logger.log('[search-cache] invalidated', { organizationId, keyCount: keys.length })
      }
    } catch (error) {
      logger.warn('[search-cache] invalidate failed', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const searchCache = new SearchCache()
