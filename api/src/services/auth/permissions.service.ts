import { prisma } from '../../lib/prisma.lib'
import {
  Permission,
  getPermissionsForOrgRole,
  getPersonalPermissions,
  getInternalAdminPermissions,
} from './permissions.config'

/**
 * Compute the effective permissions for a user, optionally scoped to an org.
 *
 * Resolution rules (in order):
 * 1. UserRole.ADMIN (Cognia staff) → full catalog regardless of org context.
 * 2. orgId provided → look up active OrganizationMember; map their OrgRole
 *    to the role's permission set. If no active membership: empty set.
 * 3. No orgId → return the personal-account permission set.
 */
export async function getEffectivePermissions(
  userId: string,
  orgId?: string | null
): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, account_type: true },
  })
  if (!user) return []

  // Cognia internal admin bypasses all org scoping.
  if (user.role === 'ADMIN') return getInternalAdminPermissions()

  if (orgId) {
    const member = await prisma.organizationMember.findFirst({
      where: {
        user_id: userId,
        organization_id: orgId,
        deactivated_at: null,
      },
      select: { role: true },
    })
    if (!member) return []
    return getPermissionsForOrgRole(member.role)
  }

  // No org context — personal account permissions.
  return getPersonalPermissions()
}

/**
 * Convenience: does the user have this permission in this scope?
 */
export async function can(
  userId: string,
  orgId: string | null | undefined,
  permission: Permission
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, orgId)
  return perms.includes(permission)
}

/**
 * Does the user hold ANY of the given permissions in this scope?
 */
export async function canAny(
  userId: string,
  orgId: string | null | undefined,
  ...permissions: Permission[]
): Promise<boolean> {
  if (permissions.length === 0) return false
  const perms = await getEffectivePermissions(userId, orgId)
  return permissions.some(p => perms.includes(p))
}

/**
 * Does the user hold ALL of the given permissions in this scope?
 */
export async function canAll(
  userId: string,
  orgId: string | null | undefined,
  ...permissions: Permission[]
): Promise<boolean> {
  if (permissions.length === 0) return true
  const perms = await getEffectivePermissions(userId, orgId)
  return permissions.every(p => perms.includes(p))
}
