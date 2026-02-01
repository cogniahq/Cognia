import { OrgRole, DocumentStatus, SourceType, Prisma } from '@prisma/client'

export { OrgRole, DocumentStatus, SourceType }

export interface CreateOrganizationInput {
  name: string
  slug: string
  description?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  description?: string
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
