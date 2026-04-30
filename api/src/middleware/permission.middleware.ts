import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth.middleware'
import { OrganizationRequest } from './organization.middleware'
import { can, getEffectivePermissions } from '../services/auth/permissions.service'
import type { Permission } from '../services/auth/permissions.config'
import { logger } from '../utils/core/logger.util'

/**
 * Configures how `requirePermission` resolves the org scope it should check.
 * Defaults to "use whatever requireOrganization put on req.organization, and
 * fall back to personal-account permissions if there is no org context."
 */
export interface PermissionOptions {
  /**
   * Use req.organization populated by `requireOrganization` middleware.
   * Default: true.
   */
  orgFromContext?: boolean
  /**
   * Read the org id from a body field (e.g. "organizationId"). Useful for
   * routes that don't have a :slug param (e.g. POST /api/api-keys).
   */
  orgFromBody?: string
  /**
   * When true and no org could be resolved, fall back to checking the
   * permission against the user's personal-account scope. Default: true.
   */
  allowPersonal?: boolean
}

const DEFAULT_OPTS: PermissionOptions = {
  orgFromContext: true,
  allowPersonal: true,
}

function resolveOrgId(
  req: AuthenticatedRequest & OrganizationRequest,
  opts: PermissionOptions
): string | null {
  if (opts.orgFromContext && (req as OrganizationRequest).organization?.id) {
    return (req as OrganizationRequest).organization!.id
  }
  if (opts.orgFromBody) {
    const v = req.body?.[opts.orgFromBody]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

/**
 * Express middleware factory: rejects with 403 unless the authenticated user
 * has `permission` in the resolved scope (org-scoped or personal).
 *
 * Returns:
 *   401 { code: 'UNAUTHORIZED' } — no req.user
 *   403 { code: 'ORG_REQUIRED' } — opts.allowPersonal=false and no org id
 *   403 { code: 'PERMISSION_DENIED', permission } — user lacks the permission
 *
 * Pairs with existing role middleware:
 *   router.post('/foo',
 *     authenticateToken,
 *     requireOrganization,
 *     requirePermission('member.invite'),
 *     handler)
 */
export function requirePermission(permission: Permission, opts: PermissionOptions = DEFAULT_OPTS) {
  const merged = { ...DEFAULT_OPTS, ...opts }
  return async (
    req: AuthenticatedRequest & OrganizationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' })
        return
      }
      const orgId = resolveOrgId(req, merged)
      if (!orgId && !merged.allowPersonal) {
        res.status(403).json({ message: 'Org context required', code: 'ORG_REQUIRED' })
        return
      }
      const allowed = await can(req.user.id, orgId, permission)
      if (!allowed) {
        logger.warn(
          `[rbac] denied user=${req.user.id} permission=${permission} orgId=${orgId ?? 'personal'}`
        )
        res.status(403).json({
          message: 'Permission denied',
          code: 'PERMISSION_DENIED',
          permission,
        })
        return
      }
      next()
    } catch (err) {
      logger.error('[rbac] requirePermission error', err)
      res.status(500).json({ message: 'Permission check failed' })
    }
  }
}

/**
 * Allow the request through if the user has ANY of the given permissions.
 * Useful when an endpoint can be invoked by users with several distinct
 * roles/capabilities (e.g. read OR export an audit log).
 */
export function requireAnyPermission(
  permissions: Permission[],
  opts: PermissionOptions = DEFAULT_OPTS
) {
  const merged = { ...DEFAULT_OPTS, ...opts }
  return async (
    req: AuthenticatedRequest & OrganizationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' })
        return
      }
      const orgId = resolveOrgId(req, merged)
      if (!orgId && !merged.allowPersonal) {
        res.status(403).json({ message: 'Org context required', code: 'ORG_REQUIRED' })
        return
      }
      const userPerms = await getEffectivePermissions(req.user.id, orgId)
      if (permissions.some(p => userPerms.includes(p))) {
        next()
        return
      }
      res.status(403).json({
        message: 'Permission denied',
        code: 'PERMISSION_DENIED',
        permissions,
      })
    } catch (err) {
      logger.error('[rbac] requireAnyPermission error', err)
      res.status(500).json({ message: 'Permission check failed' })
    }
  }
}
