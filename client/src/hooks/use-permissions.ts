import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"

/**
 * Frontend RBAC: returns the effective permission strings for the current
 * user in their currently-selected scope. When `currentOrganization` is set,
 * this returns the org-scoped permissions for that org; otherwise the
 * personal-account permissions.
 *
 * Source: hydrated from `/api/auth/me` by the auth context. If `/me` has
 * not loaded yet (or the user is unauthenticated), returns [].
 */
export function usePermissions(): string[] {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()

  if (!user) return []

  // The auth context augments `user` with `personalPermissions: string[]`
  // and `orgPermissions: { organizationId, permissions }[]`. We accept a
  // loose shape here so this hook works even when the context types have
  // not caught up yet (the field may be missing on stale cached data).
  const u = user as unknown as {
    personalPermissions?: string[]
    orgPermissions?: { organizationId: string; permissions: string[] }[]
  }

  if (currentOrganization?.id) {
    const match = u.orgPermissions?.find(
      (o) => o.organizationId === currentOrganization.id
    )
    return match?.permissions ?? []
  }
  return u.personalPermissions ?? []
}

/**
 * Convenience: does the current user have this permission in the active scope?
 */
export function useHasPermission(permission: string): boolean {
  return usePermissions().includes(permission)
}
