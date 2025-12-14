import { Request, Response, NextFunction } from 'express'
import { verifyToken, extractTokenFromHeader } from '../utils/auth/jwt.util'
import { getSessionCookieName } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import { getUserWithCache } from '../utils/core/user-cache.util'
import { apiKeyService } from '../services/core/api-key.service'
import { rateLimitService } from '../services/core/rate-limit.service'
import AppError from '../utils/http/app-error.util'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  apiKey?: {
    id: string
    developerAppId: string
    meshNamespaceId: string
  }
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = extractTokenFromHeader(req.headers.authorization)

    if (!token) {
      const cookieName = getSessionCookieName()
      token = (req.cookies && req.cookies[cookieName]) || null
    }

    if (!token) {
      res.status(401).json({ message: 'No token provided' })
      return
    }

    if (token.startsWith('ck_')) {
      const apiKeyResult = await apiKeyService.findApiKeyByPlainKey(token)
      if (!apiKeyResult) {
        res.status(401).json({ message: 'Invalid API key' })
        return
      }

      const { key: apiKeyInfo, meshNamespaceId } = apiKeyResult

      const rateLimitResult = await rateLimitService.checkRateLimit(apiKeyInfo.id)
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
        })
        return
      }

      req.apiKey = {
        id: apiKeyInfo.id,
        developerAppId: apiKeyInfo.developerAppId,
        meshNamespaceId,
      }

      await apiKeyService.updateApiKeyUsage(apiKeyInfo.id)

      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString())

      next()
      return
    }

    const payload = verifyToken(token)
    if (!payload) {
      res.status(401).json({ message: 'Invalid token' })
      return
    }

    const user = await getUserWithCache(payload.userId)

    if (!user) {
      logger.error('Auth middleware: User not found for userId:', payload.userId)
      res.status(401).json({ message: 'User not found' })
      return
    }

    req.user = {
      id: user.id,
      email: user.email || undefined,
    }

    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
    res.status(500).json({ message: 'Authentication error' })
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token = extractTokenFromHeader(req.headers.authorization)

  if (!token) {
    const cookieName = getSessionCookieName()
    token = (req.cookies && req.cookies[cookieName]) || null
  }

  if (!token) {
    next()
    return
  }

  const payload = verifyToken(token)
  if (payload) {
    req.user = {
      id: payload.userId,
      email: payload.email,
    }
  }

  next()
}
