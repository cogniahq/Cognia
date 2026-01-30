import { Request, Response, NextFunction } from 'express'
import { getRedisClient } from '../lib/redis.lib'
import { logger } from '../utils/core/logger.util'

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix: string // Redis key prefix
  message?: string // Error message
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    message = 'Too many requests, please try again later',
  } = options

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient()
      const ip = getClientIp(req)
      const key = `${keyPrefix}:${ip}`

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
        logger.warn(`Rate limit exceeded for IP ${ip} on ${keyPrefix}`)
        res.status(429).json({ message })
        return
      }

      next()
    } catch (error) {
      // If Redis fails, allow the request but log the error
      logger.error('Rate limiter error:', error)
      next()
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
