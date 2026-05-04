import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.lib'
import { extractTokenFromHeader, verifyToken } from '../utils/auth/jwt.util'
import { getSessionCookieName } from '../utils/core/env.util'

/**
 * Forced onboarding wall. Every /api/* call from a logged-in user where
 * that user has no active OrganizationMember row gets a 403
 * NO_ORG_MEMBERSHIP, which the client interceptor translates into a
 * redirect to /onboarding/workspace.
 *
 * Mounted as global app-level middleware so it runs before each route's
 * own `authenticateToken` middleware does. Because of that, this
 * middleware does its own light JWT verify — it cannot rely on `req.user`
 * being set yet. The downstream `authenticateToken` then does the
 * authoritative verification (revocation, refresh-floor, user-cache lookup,
 * etc.) and may still reject the same request as 401.
 *
 * Allowlist (no membership required):
 *   - everything outside /api/* (frontend assets, /scim, /v1, /health, etc.)
 *   - /api/auth/*           authentication itself
 *   - /api/onboarding/*     the wall has to be reachable
 *   - /api/profile/*        user-level profile (no org context)
 *   - /api/invitations/*    accept-invite flow lives here
 *   - /api/gdpr/*           account deletion / data export
 *   - POST /api/organizations           creates the user's first workspace
 *   - GET  /api/organizations/user/organizations  list-my-orgs (used post-onboarding)
 *
 * Anonymous requests pass through; the route's own auth middleware will
 * 401 them if needed.
 */

const ALLOWLIST_PREFIXES = [
  '/api/auth',
  '/api/onboarding',
  '/api/profile',
  '/api/invitations',
  '/api/gdpr',
]

const ALLOWLIST_EXACT = new Set<string>([
  '/api/organizations',
  '/api/organizations/user/organizations',
  '/api/health',
])

function isAllowlistedPath(path: string): boolean {
  if (!path.startsWith('/api/')) return true
  if (ALLOWLIST_EXACT.has(path)) return true
  for (const prefix of ALLOWLIST_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '/')) return true
  }
  return false
}

function extractUserId(req: Request): string | null {
  let token = extractTokenFromHeader(req.headers.authorization)
  if (!token) {
    const cookieName = getSessionCookieName()
    token = (req.cookies && req.cookies[cookieName]) || null
  }
  if (!token) return null
  const payload = verifyToken(token)
  return payload?.userId ?? null
}

export async function requireOrgMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const fullPath = (req.originalUrl || req.url).split('?')[0]

  if (isAllowlistedPath(fullPath)) {
    next()
    return
  }

  const userId = extractUserId(req)
  // Anonymous — let the route's own auth handle it (likely 401).
  if (!userId) {
    next()
    return
  }

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { user_id: userId, deactivated_at: null },
      select: { id: true },
    })

    if (!membership) {
      res.status(403).json({
        success: false,
        code: 'NO_ORG_MEMBERSHIP',
        message: 'Create or join a workspace before continuing.',
      })
      return
    }
  } catch {
    // Don't block on a DB hiccup — fall through to the route's own auth.
  }

  next()
}
