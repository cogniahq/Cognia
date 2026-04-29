import { Request, Response, NextFunction } from 'express'
import { getRedisClient } from '../lib/redis.lib'
import { logger } from '../utils/core/logger.util'
import type { AuthenticatedRequest } from './auth.middleware'

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix: string // Redis key prefix
  message?: string // Error message
  keyExtractor?: (req: Request) => string // defaults to client IP
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export function userOrIpKey(req: Request): string {
  const userId = (req as AuthenticatedRequest).user?.id
  return userId ? `u:${userId}` : `ip:${getClientIp(req)}`
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    message = 'Too many requests, please try again later',
  } = options

  const extractor = options.keyExtractor ?? ((r: Request) => `ip:${getClientIp(r)}`)

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient()
      const subject = extractor(req)
      const key = `${keyPrefix}:${subject}`

      const current = await redis.incr(key)

      if (current === 1) {
        // First request, set expiry
        await redis.pexpire(key, windowMs)
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current))

      const ttl = await redis.pttl(key)
      if (ttl > 0) {
        res.setHeader('X-RateLimit-Reset', Date.now() + ttl)
      }

      if (current > maxRequests) {
        logger.warn(`Rate limit exceeded for ${subject} on ${keyPrefix}`)
        res.status(429).json({ message })
        return
      }

      next()
    } catch (error) {
      logger.error('Rate limiter error:', error)
      if (process.env.SECURITY_FAIL_OPEN_BREAKGLASS === 'true') {
        logger.warn('Rate limiter BREAKGLASS engaged')
        return next()
      }
      res.status(503).json({
        message: 'Rate limiter temporarily unavailable. Please retry.',
        code: 'SECURITY_CHECK_UNAVAILABLE',
      })
      return
    }
  }
}

// Pre-configured rate limiters for auth endpoints
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  keyPrefix: 'ratelimit:login',
  message: 'Too many login attempts. Please try again in 15 minutes.',
})

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 registrations per hour per IP
  keyPrefix: 'ratelimit:register',
  message: 'Too many registration attempts. Please try again later.',
})

export const extensionTokenRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 token requests per 15 minutes
  keyPrefix: 'ratelimit:extension-token',
  message: 'Too many token requests. Please try again later.',
})

// Pre-configured rate limiters for authenticated endpoints (per-user when possible)
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: 'ratelimit:search',
  message: 'Search rate limit exceeded. Slow down or upgrade your plan.',
  keyExtractor: userOrIpKey,
})

export const exportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'ratelimit:export',
  message: 'Export rate limit exceeded. Try again in an hour.',
  keyExtractor: userOrIpKey,
})

export const integrationSyncRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'ratelimit:integration-sync',
  keyExtractor: userOrIpKey,
})
