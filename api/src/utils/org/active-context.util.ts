import { prisma } from '../../lib/prisma.lib'

export interface ActiveOrgContextResult {
  organizationId: string | null
  authorized: boolean
}

/**
 * Resolve the active organization context for a personal-scope endpoint.
 *
 * - If `organizationId` is null/empty, the caller is asking for their personal
 *   vault — `{ organizationId: null, authorized: true }`.
 * - If `organizationId` is provided, verify the calling user is an active
 *   member of that org. On success, return the trimmed id; on miss, return
 *   `{ authorized: false }` so the caller can emit a 403.
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
  if (!orgId) {
    return { organizationId: null, authorized: true }
  }
  const member = await prisma.organizationMember.findFirst({
    where: { user_id: userId, organization_id: orgId, deactivated_at: null },
    select: { id: true },
  })
  if (!member) {
    return { organizationId: orgId, authorized: false }
  }
  return { organizationId: orgId, authorized: true }
}
