import { Request, Response, NextFunction } from 'express'

import { extractTokenFromHeader } from '../utils/auth/jwt.util'
import { platformAuthService } from '../services/platform/platform-auth.service'
import type { PlatformRequestContext } from '../types/platform.types'
import AppError from '../utils/http/app-error.util'

export interface PlatformAuthenticatedRequest extends Request {
  platform?: PlatformRequestContext
}

export async function authenticatePlatformApp(
  req: PlatformAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const appId = req.header('x-platform-app-id')?.trim()
    const secret = extractTokenFromHeader(req.header('authorization'))

    if (!appId || !secret) {
      return next(new AppError('Platform credentials are required', 401))
    }

    const app = await platformAuthService.authenticateApp(appId, secret)

    if (!app) {
      return next(new AppError('Invalid platform credentials', 401))
    }

    const actor = platformAuthService.parseActorContext(req.headers)

    req.platform = {
      app,
      actor,
    }

    next()
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to authenticate platform request',
        401
      )
    )
  }
}

export async function requirePlatformTenantAccess(
  req: PlatformAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.platform) {
      return next(new AppError('Platform authentication required', 401))
    }

    const tenantLink = await platformAuthService.resolveTenant(
      req.platform.app.app_id,
      req.platform.actor.tenantExternalId
    )

    if (!tenantLink) {
      return next(new AppError('Tenant mapping not found', 404))
    }

    req.platform.tenantLink = tenantLink
    next()
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to resolve platform tenant',
        403
      )
    )
  }
}

export async function requirePlatformActorAccess(
  req: PlatformAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.platform) {
      return next(new AppError('Platform authentication required', 401))
    }

    const userLink = await platformAuthService.resolveUser(
      req.platform.app.app_id,
      req.platform.actor.actorExternalUserId
    )

    if (!userLink) {
      return next(new AppError('Actor mapping not found', 403))
    }

    if (req.platform.tenantLink) {
      const hasMembership = await platformAuthService.hasOrganizationMembership(
        req.platform.tenantLink.organization_id,
        userLink.user_id
      )

      if (!hasMembership) {
        return next(new AppError('Actor is not a member of the tenant organization', 403))
      }
    }

    req.platform.userLink = userLink
    next()
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : 'Failed to resolve platform actor',
        403
      )
    )
  }
}
