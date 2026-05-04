export interface DestinationWorkspace {
  id: string
  name: string
  slug: string
}

export interface DestinationOrganization {
  id: string
  slug: string
  name: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  workspaces: DestinationWorkspace[]
}

/**
 * Wire shape returned by GET /api/extension/destinations. Cognia is
 * org-only; `personal: true` is kept on the wire for back-compat with
 * pinned extension builds but the popup ignores it. `default` is the
 * user's stored default destination.
 */
export interface DestinationsPayload {
  personal: true
  organizations: DestinationOrganization[]
  default: {
    organizationId: string | null
    workspaceId: string | null
  }
}

/**
 * Resolved capture target used when posting a memory. The server requires
 * `organizationId` to be set (org-only model) — null means "no default
 * configured", and the caller (manual capture / auto-capture) must decide
 * whether to prompt the user or skip the capture.
 */
export interface CaptureTarget {
  organizationId: string | null
  workspaceId: string | null
}
