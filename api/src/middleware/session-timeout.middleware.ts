import { Response, NextFunction } from 'express'
import { OrganizationRequest } from './organization.middleware'
import { logger } from '../utils/core/logger.util'

/**
 * Session timeout durations in milliseconds
 */
const TIMEOUT_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * Parse session timeout string to milliseconds
 */
function parseTimeout(timeout: string): number {
  return TIMEOUT_MS[timeout] || TIMEOUT_MS['7d'] // Default to 7 days
}

/**
 * Middleware to enforce organization session timeout
 * Checks if the JWT token was issued within the allowed timeframe
 *
 * Must be used after authenticateToken and requireOrganization middleware
 */
export function enforceSessionTimeout(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const org = req.organization
    const user = req.user

    // If no organization or no user, skip timeout check
    if (!org || !user) {
      return next()
    }

    // Get token issued-at time from user object (set by authenticateToken)
    const tokenIssuedAt = user.iat
    if (!tokenIssuedAt) {
      return next()
    }

    // Calculate timeout based on org settings
    const timeoutMs = parseTimeout(org.session_timeout)
    const tokenAgeMs = Date.now() - tokenIssuedAt * 1000 // iat is in seconds

    if (tokenAgeMs > timeoutMs) {
      logger.log('[session-timeout] Session expired', {
        organizationId: org.id,
        userId: user.id,
        tokenAge: Math.round(tokenAgeMs / 1000 / 60), // minutes
        timeout: org.session_timeout,
      })

      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
        code: 'SESSION_EXPIRED',
        timeout: org.session_timeout,
      })
    }

    next()
  } catch (error) {
    logger.error('[session-timeout] Error checking session timeout', {
      error: error instanceof Error ? error.message : String(error),
    })
    // On error, allow access (fail open)
    next()
  }
}
