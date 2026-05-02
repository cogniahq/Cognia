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
 * Wire shape returned by GET /api/extension/destinations.
 * Personal vault is implicit (`personal: true`); orgs/workspaces the user has
 * access to are listed; `default` is the user's stored default destination.
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
 * Resolved capture target used when posting a memory. Personal vault is
 * `{ organizationId: null, workspaceId: null }`. The server treats both
 * undefined and null the same on ingestion.
 */
export interface CaptureTarget {
  organizationId: string | null
  workspaceId: string | null
}
