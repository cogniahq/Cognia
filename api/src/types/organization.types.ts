import { OrgRole, DocumentStatus, SourceType, Prisma } from '@prisma/client'

export { OrgRole, DocumentStatus, SourceType }

export interface CreateOrganizationInput {
  name: string
  slug: string
  description?: string
  industry?: string
  teamSize?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  description?: string
}

// Enterprise profile update types
export interface UpdateOrganizationProfileInput {
  name?: string
  slug?: string
  description?: string
  logo?: string
  website?: string
  streetAddress?: string
  city?: string
  stateRegion?: string
  postalCode?: string
  country?: string
  timezone?: string
}

export interface UpdateOrganizationBillingInput {
  legalName?: string
  billingEmail?: string
  billingAddress?: {
    street?: string
    city?: string
    stateRegion?: string
    postalCode?: string
    country?: string
  }
  vatTaxId?: string
  plan?: 'free' | 'pro' | 'enterprise'
}

export interface UpdateOrganizationSecurityInput {
  dataResidency?: 'auto' | 'us' | 'eu' | 'asia-pacific'
  require2FA?: boolean
  sessionTimeout?: '1h' | '8h' | '24h' | '7d' | '30d'
  passwordPolicy?: 'standard' | 'strong' | 'custom'
  auditRetention?: '30d' | '90d' | '365d' | 'unlimited'
  ipAllowlist?: string[]
  ssoEnabled?: boolean
  ssoConfig?: {
    provider?: string
    ssoUrl?: string
    entityId?: string
    certificate?: string
  }
}

export interface SetupProgress {
  completedSteps: string[]
  totalSteps: number
  percentComplete: number
  startedAt: Date | null
  completedAt: Date | null
}

export interface CreateInvitationInput {
  email: string
  role?: OrgRole
}

export interface InvitationInfo {
  id: string
  organizationId: string
  email: string
  role: OrgRole
  invitedBy: string
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface AddMemberInput {
  userId: string
  role?: OrgRole
}

export interface UpdateMemberInput {
  role: OrgRole
}

export interface OrganizationWithMembers {
  id: string
  name: string
  slug: string
  description?: string | null
  created_at: Date
  updated_at: Date
  members: OrganizationMemberInfo[]
  // Enterprise profile fields
  industry?: string | null
  team_size?: string | null
  logo?: string | null
  website?: string | null
  street_address?: string | null
  city?: string | null
  state_region?: string | null
  postal_code?: string | null
  country?: string | null
  timezone?: string | null
  // Billing fields
  legal_name?: string | null
  billing_email?: string | null
  billing_address?: any | null
  vat_tax_id?: string | null
  plan?: string
  // Security fields
  data_residency?: string
  require_2fa?: boolean
  session_timeout?: string
  password_policy?: string
  audit_retention?: string
  ip_allowlist?: string[]
  sso_enabled?: boolean
  sso_config?: any | null
  // Setup tracking
  setup_completed_steps?: string[]
  setup_started_at?: Date | null
  setup_completed_at?: Date | null
  security_prompt_shown?: boolean
}

export interface OrganizationMemberInfo {
  id: string
  user_id: string
  role: OrgRole
  created_at: Date
  user: {
    id: string
    email: string | null
  }
}

export interface OrganizationContext {
  organizationId: string
  organizationSlug: string
  userRole: OrgRole
}

export interface DocumentUploadInput {
  organizationId: string
  uploaderId: string
  file: {
    buffer: Buffer
    originalname: string
    mimetype: string
    size: number
  }
}

export interface DocumentInfo {
  id: string
  organization_id: string
  uploader_id: string
  filename: string
  original_name: string
  mime_type: string
  file_size: number
  storage_path: string
  storage_provider: string
  status: DocumentStatus
  error_message: string | null
  page_count: number | null
  metadata: Prisma.JsonValue | null
  created_at: Date
  updated_at: Date
}

export interface DocumentChunkInfo {
  id: string
  document_id: string
  chunk_index: number
  content: string
  page_number: number | null
  char_start: number | null
  char_end: number | null
  memory_id: string | null
  created_at: Date
}

export interface DocumentProcessingJob {
  documentId: string
  organizationId: string
  uploaderId: string
  storagePath: string
  mimeType: string
  filename: string
}
