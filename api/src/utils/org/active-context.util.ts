import { prisma } from '../../lib/prisma.lib'

export interface ActiveOrgContextResult {
  organizationId: string | null
  authorized: boolean
}

/**
 * Resolve the active organization context for an org-scoped endpoint.
 *
 * - If `organizationId` is provided, verify the calling user is an active
 *   member of that org. On success, return the trimmed id; on miss, return
 *   `{ authorized: false }` so the caller can emit a 403.
 * - If `organizationId` is null/empty, fall back to the user's first active
 *   org membership (oldest first). The forced onboarding wall guarantees
 *   every authenticated user has at least one membership; if somehow not,
 *   return `{ organizationId: null, authorized: false }`.
 *
 * The membership check mirrors the canonical pattern in `requireOrganization`
 * middleware and `share.service.createShare`: an `OrganizationMember` row
 * with `deactivated_at: null`.
 */
export async function resolveActiveOrgContext(
  userId: string,
  organizationId: string | null | undefined
): Promise<ActiveOrgContextResult> {
  const orgId = typeof organizationId === 'string' ? organizationId.trim() : ''
  if (orgId) {
    const member = await prisma.organizationMember.findFirst({
      where: { user_id: userId, organization_id: orgId, deactivated_at: null },
      select: { id: true },
    })
    if (!member) {
      return { organizationId: orgId, authorized: false }
    }
    return { organizationId: orgId, authorized: true }
  }
  const fallback = await prisma.organizationMember.findFirst({
    where: { user_id: userId, deactivated_at: null },
    select: { organization_id: true },
    orderBy: { created_at: 'asc' },
  })
  if (!fallback) {
    return { organizationId: null, authorized: false }
  }
  return { organizationId: fallback.organization_id, authorized: true }
}
