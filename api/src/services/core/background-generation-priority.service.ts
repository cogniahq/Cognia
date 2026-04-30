import crypto from 'crypto'

import { getRedisClient, scanKeys } from '../../lib/redis.lib'
import { logger } from '../../utils/core/logger.util'

const SEARCH_PRIORITY_LEASE_KEY = 'background_generation_priority:search'
const SEARCH_JOB_KEY_PATTERN = 'search_job:*'
const SEARCH_JOB_SCAN_LIMIT = 250
const ACTIVE_SEARCH_JOB_STATUSES = new Set(['pending', 'processing'])

type RedisClient = ReturnType<typeof getRedisClient>

type SearchJobRecord = {
  status?: string
}

export class BackgroundGenerationPriorityService {
  private getClient(): RedisClient {
    return getRedisClient()
  }

  async acquireSearchPriorityLease(ttlSeconds: number = 300): Promise<string> {
    const token = crypto.randomUUID()
    const client = this.getClient()

    await client.set(SEARCH_PRIORITY_LEASE_KEY, token, 'EX', Math.max(ttlSeconds, 1))
    return token
  }

  async releaseSearchPriorityLease(token: string): Promise<boolean> {
    const client = this.getClient()
    const current = await client.get(SEARCH_PRIORITY_LEASE_KEY)

    if (current !== token) {
      return false
    }

    await client.del(SEARCH_PRIORITY_LEASE_KEY)
    return true
  }

  async isSearchPriorityLeaseActive(): Promise<boolean> {
    try {
      const client = this.getClient()
      const leaseValue = await client.get(SEARCH_PRIORITY_LEASE_KEY)
      if (leaseValue) {
        return true
      }

      const jobKeys = await scanKeys(client, SEARCH_JOB_KEY_PATTERN, SEARCH_JOB_SCAN_LIMIT)
      for (const key of jobKeys) {
        if (key === SEARCH_PRIORITY_LEASE_KEY) {
          continue
        }

        const rawJob = await client.get(key)
        if (!rawJob) {
          continue
        }

        try {
          const parsed = JSON.parse(rawJob) as SearchJobRecord
          if (parsed.status && ACTIVE_SEARCH_JOB_STATUSES.has(parsed.status)) {
            return true
          }
        } catch {
          // Ignore malformed job payloads and keep scanning.
        }
      }

      return false
    } catch (error) {
      logger.warn(
        '[background-priority] failed to inspect search priority gate, allowing background work',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      )
      return false
    }
  }

  async shouldDeferBackgroundGeneration(): Promise<boolean> {
    return this.isSearchPriorityLeaseActive()
  }

  async hasActiveSearchLease(): Promise<boolean> {
    return this.isSearchPriorityLeaseActive()
  }
}

export const backgroundGenerationPriorityService = new BackgroundGenerationPriorityService()
