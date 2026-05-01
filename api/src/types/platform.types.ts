import type {
  DocumentStatus,
  OrgRole,
  Organization,
  PlatformTenantLink,
  PlatformUploadSession,
  PlatformUserLink,
  TrustedPlatformApp,
  User,
} from '@prisma/client'

export const PLATFORM_APP_ID_HEADER = 'x-platform-app-id'
export const PLATFORM_TENANT_HEADER = 'x-platform-tenant-external-id'
export const PLATFORM_ACTOR_USER_HEADER = 'x-platform-actor-external-user-id'
export const PLATFORM_ACTOR_EMAIL_HEADER = 'x-platform-actor-email'
export const PLATFORM_ACTOR_ROLE_HEADER = 'x-platform-actor-role'
export const PLATFORM_REQUEST_ID_HEADER = 'x-platform-request-id'

export interface PlatformActorContext {
  tenantExternalId: string
  actorExternalUserId: string
  actorEmail: string
  actorRole: string
  requestId: string
}

export interface PlatformTenantRef {
  externalId: string
  name: string
  slug?: string
  description?: string | null
  active?: boolean
}

export interface PlatformUserRef {
  externalId: string
  email: string
  role?: string
  active?: boolean
}

export interface PlatformMembershipRef {
  userExternalId: string
  role: OrgRole
}

export interface PlatformDocumentMetadata {
  documentType?: string
  [key: string]: unknown
}

export interface PlatformDocumentRef {
  id: string
  organizationId: string
  originalName: string
  mimeType: string
  sizeBytes: number
  status: DocumentStatus
  createdAt: string
  updatedAt: string
  metadata?: PlatformDocumentMetadata | null
}

export interface PlatformCitation {
  index: number
  memoryId: string
  documentId?: string
  documentName?: string
  pageNumber?: number
  sourceType?: string
  title?: string
  url?: string
}

export interface PlatformSearchRequest {
  tenantExternalId: string
  query: string
  limit?: number
  includeAnswer?: boolean
  includeCitations?: boolean
  excludeSourceTypes?: string[]
}

export interface PlatformSearchResult {
  query: string
  totalResults: number
  answer?: string
  citations?: PlatformCitation[]
  results: Array<{
    memoryId: string
    documentId?: string
    documentName?: string
    pageNumber?: number
    score: number
    title?: string
    url?: string
    sourceType: string
    contentPreview: string
    metadata?: PlatformDocumentMetadata | null
  }>
}

export interface PlatformRequestContext {
  app: TrustedPlatformApp
  actor: PlatformActorContext
  tenantLink?: PlatformTenantLink & { organization: Organization }
  userLink?: PlatformUserLink & { user: User }
  uploadSession?: PlatformUploadSession
}
