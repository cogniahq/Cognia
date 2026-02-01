export type OrgRole = "ADMIN" | "EDITOR" | "VIEWER"

export type DocumentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
  // Enterprise profile fields
  industry?: string
  team_size?: string
  logo?: string
  website?: string
  street_address?: string
  city?: string
  state_region?: string
  postal_code?: string
  country?: string
  timezone?: string
  // Billing fields
  legal_name?: string
  billing_email?: string
  billing_address?: Record<string, string>
  vat_tax_id?: string
  plan?: "free" | "pro" | "enterprise"
  // Security fields
  data_residency?: string
  require_2fa?: boolean
  session_timeout?: string
  password_policy?: string
  audit_retention?: string
  ip_allowlist?: string[]
  sso_enabled?: boolean
  sso_config?: Record<string, string>
  // Setup tracking
  setup_completed_steps?: string[]
  setup_started_at?: string
  setup_completed_at?: string
  security_prompt_shown?: boolean
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  created_at: string
  user?: {
    id: string
    email: string
  }
}

export interface OrganizationWithRole extends Organization {
  userRole: OrgRole
  memberCount?: number
}

export interface Document {
  id: string
  organization_id: string
  uploader_id: string
  original_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  status: DocumentStatus
  error_message?: string
  page_count?: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  memory_id?: string
  chunk_index: number
  content: string
  page_number?: number
  char_start: number
  char_end: number
  created_at: string
}

export interface CreateOrganizationRequest {
  name: string
  slug?: string
  description?: string
  industry?: string
  teamSize?: string
}

export interface InviteMemberRequest {
  email: string
  role: OrgRole
}

export interface UpdateMemberRoleRequest {
  role: OrgRole
}

export interface OrganizationSearchResult {
  memoryId: string
  documentId?: string
  documentName?: string
  chunkIndex?: number
  pageNumber?: number
  content: string
  contentPreview: string
  score: number
  sourceType: string
  title?: string
  url?: string
}

export interface OrganizationSearchResponse {
  results: OrganizationSearchResult[]
  answer?: string
  citations?: Array<{
    index: number
    documentName?: string
    pageNumber?: number
    memoryId: string
  }>
  totalResults: number
}
