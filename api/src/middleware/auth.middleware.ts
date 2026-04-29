import { Request, Response, NextFunction } from 'express'
import { verifyToken, extractTokenFromHeader } from '../utils/auth/jwt.util'
import { getSessionCookieName } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import { getUserWithCache } from '../utils/core/user-cache.util'
import { isJtiRevoked, isUserRevokedSince } from '../services/auth/jwt-revocation.service'
import type { UserRole } from '@prisma/client'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    role?: UserRole
    iat?: number // Token issued-at timestamp (seconds since epoch)
    jti?: string // JWT id for per-token revocation
  }
}

function extractTokenFromRequest(
  req: AuthenticatedRequest,
  options?: { allowQueryToken?: boolean }
): string | null {
  let token = extractTokenFromHeader(req.headers.authorization)

  if (!token) {
    const cookieName = getSessionCookieName()
    token = (req.cookies && req.cookies[cookieName]) || null
  }

  if (!token && options?.allowQueryToken) {
    const tokenQueryParam = req.query.token
    if (typeof tokenQueryParam === 'string' && tokenQueryParam.trim()) {
      token = tokenQueryParam.trim()
    }
  }

  return token
}

async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  options?: { allowQueryToken?: boolean }
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req, options)

    if (!token) {
      res.status(401).json({ message: 'No token provided' })
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

    if (payload.jti && (await isJtiRevoked(payload.jti))) {
      res.status(401).json({ message: 'Token revoked' })
      return
    }
    if (payload.iat && (await isUserRevokedSince(user.id, payload.iat))) {
      res.status(401).json({ message: 'Session revoked' })
      return
    }

    req.user = {
      id: user.id,
      email: user.email || undefined,
      role: user.role,
      iat: payload.iat, // Token issued-at for session timeout checking
      jti: payload.jti,
    }

    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
    res.status(500).json({ message: 'Authentication error' })
  }
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  return authenticateRequest(req, res, next)
}

export async function authenticateTokenWithQuery(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  return authenticateRequest(req, res, next, { allowQueryToken: true })
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req)

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

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }

  if (req.user.role !== 'ADMIN') {
    logger.warn(`Admin access denied for user ${req.user.id}`)
    res.status(403).json({ message: 'Admin access required' })
    return
  }

  next()
}
