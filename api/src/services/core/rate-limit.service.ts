import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

class InMemoryRateLimitStore {
  private store: Map<string, { count: number; resetAt: Date }> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.cleanupInterval = setInterval(() => {
      const now = new Date()
      for (const [key, value] of this.store.entries()) {
        if (value.resetAt < now) {
          this.store.delete(key)
        }
      }
    }, 60000)
  }

  get(key: string): { count: number; resetAt: Date } | undefined {
    return this.store.get(key)
  }

  set(key: string, count: number, resetAt: Date): void {
    this.store.set(key, { count, resetAt })
  }

  increment(key: string): number {
    const current = this.store.get(key)
    if (!current) {
      return 0
    }
    const newCount = current.count + 1
    this.store.set(key, { ...current, count: newCount })
    return newCount
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const rateLimitStore = new InMemoryRateLimitStore()

export class RateLimitService {
  async checkRateLimit(keyId: string): Promise<RateLimitResult> {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
        select: {
          rate_limit: true,
          rate_limit_window: true,
        },
      })

      if (!apiKey || !apiKey.rate_limit || !apiKey.rate_limit_window) {
        return {
          allowed: true,
          remaining: Number.MAX_SAFE_INTEGER,
          resetAt: new Date(Date.now() + 3600000),
        }
      }

      const limit = apiKey.rate_limit
      const windowSeconds = apiKey.rate_limit_window
      const now = new Date()
      const resetAt = new Date(now.getTime() + windowSeconds * 1000)

      const storeKey = `${keyId}:${Math.floor(now.getTime() / (windowSeconds * 1000))}`
      const current = rateLimitStore.get(storeKey)

      if (!current) {
        rateLimitStore.set(storeKey, 1, resetAt)
        return {
          allowed: true,
          remaining: limit - 1,
          resetAt,
        }
      }

      if (current.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: current.resetAt,
        }
      }

      const newCount = rateLimitStore.increment(storeKey)
      return {
        allowed: true,
        remaining: limit - newCount,
        resetAt: current.resetAt,
      }
    } catch (error) {
      logger.error('Error checking rate limit:', error)
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: new Date(Date.now() + 3600000),
      }
    }
  }
}

export const rateLimitService = new RateLimitService()

