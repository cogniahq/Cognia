import { Response, NextFunction } from 'express'
import { OrgRole } from '@prisma/client'
import { AuthenticatedRequest } from './auth.middleware'
import { organizationAccessService } from '../services/organization/organization-access.service'
import { logger } from '../utils/core/logger.util'

export interface OrganizationRequest extends AuthenticatedRequest {
  organization?: {
    id: string
    slug: string
    userRole: OrgRole
    // Security settings
    ip_allowlist: string[]
    session_timeout: string
    require_2fa: boolean
  }
}

/**
 * Middleware to load organization context from :slug param
 * Requires user to be a member of the organization
 */
export async function requireOrganization(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const { slug } = req.params
    if (!slug) {
      res.status(400).json({ message: 'Organization slug is required' })
      return
    }

    const membership = await organizationAccessService.getUserMembership(req.user.id, slug)

    if (!membership) {
      res.status(404).json({ message: 'Organization not found or access denied' })
      return
    }

    req.organization = {
      id: membership.organization.id,
      slug: membership.organization.slug,
      userRole: membership.role,
      // Security settings
      ip_allowlist: membership.organization.ip_allowlist,
      session_timeout: membership.organization.session_timeout,
      require_2fa: membership.organization.require_2fa,
    }

    next()
  } catch (error) {
    logger.error('Organization middleware error:', error)
    res.status(500).json({ message: 'Failed to load organization context' })
  }
}

/**
 * Middleware factory to require minimum role level
 */
export function requireOrgRole(...allowedRoles: OrgRole[]) {
  return (req: OrganizationRequest, res: Response, next: NextFunction): void => {
    if (!req.organization) {
      res.status(500).json({ message: 'Organization context not loaded' })
      return
    }

    if (!allowedRoles.includes(req.organization.userRole)) {
      logger.warn(
        `Access denied for user ${req.user?.id} with role ${req.organization.userRole} ` +
          `(required: ${allowedRoles.join(' or ')})`
      )
      res.status(403).json({
        message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
      })
      return
    }

    next()
  }
}

/**
 * Convenience middleware for admin-only organization actions
 */
export const requireOrgAdmin = requireOrgRole(OrgRole.ADMIN)

/**
 * Convenience middleware for editor-level actions (upload, modify)
 */
export const requireOrgEditor = requireOrgRole(OrgRole.ADMIN, OrgRole.EDITOR)

/**
 * Convenience middleware for viewer-level actions (view, search)
 */
export const requireOrgViewer = requireOrgRole(OrgRole.ADMIN, OrgRole.EDITOR, OrgRole.VIEWER)
