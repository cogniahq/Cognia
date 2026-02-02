import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.lib'
import { OrganizationRequest } from './organization.middleware'
import { logger } from '../utils/core/logger.util'

/**
 * Middleware to enforce organization's require_2fa setting
 *
 * If an organization requires 2FA, all members must have 2FA enabled
 * to access organization resources.
 *
 * Must be used after authenticateToken and requireOrganization middleware.
 */
export async function enforce2FARequirement(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const org = req.organization
    const userId = req.user?.id

    // Skip if no organization or org doesn't require 2FA
    if (!org || !org.require_2fa) {
      return next()
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      })
    }

    // Check if user has 2FA enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      })
    }

    if (!user.two_factor_enabled) {
      logger.warn('[2fa-requirement] Access denied - 2FA not enabled', {
        organizationId: org.id,
        organizationSlug: org.slug,
        userId,
      })

      return res.status(403).json({
        success: false,
        message: 'This organization requires two-factor authentication. Please enable 2FA in your account settings.',
        code: '2FA_REQUIRED',
        requiresSetup: true,
      })
    }

    next()
  } catch (error) {
    logger.error('[2fa-requirement] Error checking 2FA requirement', {
      error: error instanceof Error ? error.message : String(error),
    })
    // On error, allow access (fail open) to prevent lockouts
    next()
  }
}
