import type { OrgRole } from '@prisma/client'

/**
 * Cognia permission catalog.
 *
 * Phase 7 RBAC: granular permission strings layered on top of the existing
 * `OrgRole` (ADMIN | EDITOR | VIEWER) and `UserRole` (USER | ADMIN) enums.
 *
 * This list is the single source of truth — every other RBAC primitive in
 * the codebase (role mapping, middleware, frontend gates) is derived from
 * this `PERMISSIONS` const array. DB-driven custom roles are Phase 8 work;
 * for now the role-to-permission mapping is hardcoded below.
 */
export const PERMISSIONS = [
  // Memory CRUD + sharing
  'memory.read',
  'memory.write',
  'memory.delete',
  'memory.bulk_delete',
  'memory.share',
  'memory.comment',

  // Workspace lifecycle
  'workspace.read',
  'workspace.write',
  'workspace.delete',

  // Tags
  'tag.read',
  'tag.write',

  // Integrations
  'integration.read',
  'integration.connect',
  'integration.disconnect',

  // Member management
  'member.invite',
  'member.remove',
  'member.update_role',

  // Billing
  'billing.read',
  'billing.manage',
  'billing.cancel',

  // Audit log
  'audit.read',
  'audit.export',

  // Org settings
  'org.read',
  'org.update_settings',
  'org.update_security',
  'org.delete',

  // API keys
  'api_key.create',
  'api_key.revoke',

  // SCIM provisioning
  'scim.manage',

  // SSO config
  'sso.configure',

  // Compliance — eDiscovery + legal hold
  'ediscovery.search',
  'legal_hold.apply',

  // BYOK / LLM config
  'llm.configure',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const VIEWER_PERMISSIONS: Permission[] = [
  'memory.read',
  'memory.comment',
  'workspace.read',
  'tag.read',
  'integration.read',
  'audit.read',
  'org.read',
  'billing.read',
]

const EDITOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  'memory.write',
  'memory.delete',
  'memory.bulk_delete',
  'memory.share',
  'workspace.write',
  'tag.write',
]

// Org admins get every permission in the catalog.
const ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS]

// Personal accounts (no org context) — full set on their own resources but
// no org-scoped permissions (member, sso, scim, audit, ediscovery, etc.).
const PERSONAL_PERMISSIONS: Permission[] = [
  'memory.read',
  'memory.write',
  'memory.delete',
  'memory.bulk_delete',
  'memory.share',
  'memory.comment',
  'workspace.read',
  'workspace.write',
  'workspace.delete',
  'tag.read',
  'tag.write',
  'integration.read',
  'integration.connect',
  'integration.disconnect',
  'billing.read',
  'api_key.create',
  'api_key.revoke',
]

/**
 * Returns the permissions granted to a member of an organization with the
 * given OrgRole. Org members get role-derived permissions only; staff
 * (UserRole=ADMIN) bypass via `getInternalAdminPermissions`.
 */
export function getPermissionsForOrgRole(role: OrgRole): Permission[] {
  switch (role) {
    case 'ADMIN':
      return ADMIN_PERMISSIONS
    case 'EDITOR':
      return EDITOR_PERMISSIONS
    case 'VIEWER':
      return VIEWER_PERMISSIONS
    default:
      return []
  }
}

/**
 * Returns the permissions for a user acting on their personal account
 * (no org scope).
 */
export function getPersonalPermissions(): Permission[] {
  return PERSONAL_PERMISSIONS
}

/**
 * Returns the full permission set for a Cognia internal admin (UserRole.ADMIN).
 * Internal admins bypass org-scoping and receive every permission.
 */
export function getInternalAdminPermissions(): Permission[] {
  return [...PERMISSIONS]
}
