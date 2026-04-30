import { ReactNode } from "react"

import { useHasPermission } from "@/hooks/use-permissions"

interface CanProps {
  /** Permission string from the API permission catalog (e.g. "billing.manage"). */
  permission: string
  /** Rendered when the user holds the permission. */
  children: ReactNode
  /**
   * Rendered when the user lacks the permission. Defaults to `null` so the
   * gated UI silently disappears for users who can't use it.
   */
  fallback?: ReactNode
}

/**
 * Frontend permission gate. Hides children unless the current user
 * (in their active org / personal scope) holds `permission`.
 *
 * Pairs with the backend `requirePermission(...)` middleware — the same
 * permission strings are used on both sides.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = useHasPermission(permission)
  return <>{allowed ? children : fallback}</>
}
