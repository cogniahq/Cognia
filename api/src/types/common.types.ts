import { Prisma, MemoryType } from '@prisma/client'

export type OperationType =
  | 'generate_content'
  | 'generate_embedding'
  | 'extract_metadata'
  | 'summarize_content'
  | 'evaluate_relationship'
  | 'search'
  | 'generate_wow_facts'
  | 'generate_narrative_summary'

export interface TokenUsageRecord {
  id?: string
  userId?: string
  user_id?: string
  operationType?: OperationType
  operation_type?: OperationType
  inputTokens?: number
  input_tokens?: number
  outputTokens?: number
  output_tokens?: number
  modelUsed?: string
  model_used?: string | null
  created_at?: Date
}

export interface TokenUsageRecordInput {
  userId: string
  operationType: OperationType
  inputTokens: number
  outputTokens: number
  modelUsed?: string
}

export type AuditEventType =
  | 'memory_created'
  | 'memory_updated'
  | 'memory_deleted'
  | 'memory_searched'
  | 'profile_updated'
  | 'export_initiated'
  | 'import_initiated'
  | 'memory_capture'
  | 'memory_search'
  | 'memory_delete'
  | 'memory_update'
  | 'export_data'
  | 'import_data'
  | 'platform_tenant_sync'
  | 'platform_user_sync'
  | 'platform_membership_sync'
  | 'platform_document_upload'
  | 'platform_search'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_revoked'
  | 'password_changed'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'backup_codes_regenerated'
  | 'password_reset_requested'
  | 'password_reset_completed'
  // Org lifecycle
  | 'organization_created'
  | 'organization_settings_changed'
  | 'organization_deleted'
  // Members
  | 'member_invited'
  | 'invitation_resent'
  | 'invitation_revoked'
  | 'invitation_accepted'
  | 'member_added'
  | 'member_removed'
  | 'member_deactivated'
  | 'role_changed'
  // Integrations
  | 'integration_connected'
  | 'integration_disconnected'
  | 'integration_token_refreshed'
  | 'integration_sync_failed'
  // Data
  | 'memory_shared'
  | 'memory_unshared'
  | 'comment_posted'
  | 'bulk_delete'
  | 'data_exported'
  | 'data_imported'
  | 'account_deleted'
  // API + SSO (placeholders for Phase 6/2)
  | 'api_key_created'
  | 'api_key_revoked'
  | 'sso_login'
  | 'scim_user_provisioned'
  | 'scim_user_deprovisioned'
  | 'ediscovery_search'
  | 'legal_hold_applied'
  | 'legal_hold_released'

export type AuditEventCategory =
  | 'capture'
  | 'search'
  | 'data_management'
  | 'platform'
  | 'authentication'
  | 'security'
  | 'organization'
  | 'integration'
  | 'compliance'
  | 'api'

export type ExportBundle = {
  version: string
  exportedAt?: string
  exported_at?: string
  user?: {
    id: string
    email: string | null
  }
  user_id?: string
  memories: Array<{
    id: string
    title: string | null
    content: string
    url: string | null
    source?: string
    timestamp?: string
    created_at: string
    page_metadata: Record<string, unknown> | Prisma.JsonValue
    memory_type?: string | MemoryType
    importance_score?: number | null
    confidence_score?: number | null
  }>
  profile: {
    static_profile_text?: string | null
    dynamic_profile_text?: string | null
    static_profile_json: Record<string, unknown> | Prisma.JsonValue | null
    dynamic_profile_json: Record<string, unknown> | Prisma.JsonValue | null
  } | null
}
