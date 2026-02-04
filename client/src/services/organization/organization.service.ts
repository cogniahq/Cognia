import type {
  CreateOrganizationRequest,
  Document,
  InviteMemberRequest,
  Organization,
  OrganizationMember,
  OrganizationSearchResponse,
  OrganizationWithRole,
  UpdateMemberRoleRequest,
} from "../../types/organization"
import { requireAuthToken } from "../../utils/auth"
import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
} from "../../utils/http"

const baseUrl = "/organizations"

// Organization CRUD
export async function createOrganization(
  data: CreateOrganizationRequest
): Promise<Organization> {
  requireAuthToken()
  const response = await postRequest(baseUrl, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to create organization")
  }
  return response.data.data.organization
}

export async function getUserOrganizations(): Promise<OrganizationWithRole[]> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/user/organizations`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch organizations")
  }
  return response.data.data.organizations || []
}

export async function getOrganization(
  slug: string
): Promise<OrganizationWithRole> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Organization not found")
  }
  return response.data.data.organization
}

export async function updateOrganization(
  slug: string,
  data: Partial<CreateOrganizationRequest>
): Promise<Organization> {
  requireAuthToken()
  const response = await patchRequest(`${baseUrl}/${slug}`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update organization")
  }
  return response.data.data.organization
}

export async function deleteOrganization(slug: string): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`${baseUrl}/${slug}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to delete organization")
  }
}

// Member management
export async function getOrganizationMembers(
  slug: string
): Promise<OrganizationMember[]> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/members`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch members")
  }
  return response.data.data.members || []
}

export async function inviteMember(
  slug: string,
  data: InviteMemberRequest
): Promise<OrganizationMember> {
  requireAuthToken()
  const response = await postRequest(`${baseUrl}/${slug}/members`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to invite member")
  }
  return response.data.data.member
}

export async function updateMemberRole(
  slug: string,
  memberId: string,
  data: UpdateMemberRoleRequest
): Promise<OrganizationMember> {
  requireAuthToken()
  const response = await patchRequest(
    `${baseUrl}/${slug}/members/${memberId}`,
    data
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update member role")
  }
  return response.data.data.member
}

export async function removeMember(
  slug: string,
  memberId: string
): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`${baseUrl}/${slug}/members/${memberId}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to remove member")
  }
}

// Document management
export async function getOrganizationDocuments(
  slug: string
): Promise<Document[]> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/documents`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch documents")
  }
  return response.data.data.documents || []
}

export async function uploadDocument(
  slug: string,
  file: File
): Promise<Document> {
  requireAuthToken()
  const formData = new FormData()
  formData.append("file", file)

  const { axiosInstance } = await import("../../utils/http")
  const response = await axiosInstance.post(
    `${baseUrl}/${slug}/documents`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 300000, // 5 minute timeout for uploads
    }
  )

  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to upload document")
  }
  return response.data.data.document
}

export async function deleteDocument(
  slug: string,
  documentId: string,
  type?: "document" | "integration"
): Promise<void> {
  requireAuthToken()
  const url =
    type === "integration"
      ? `${baseUrl}/${slug}/documents/${documentId}?type=integration`
      : `${baseUrl}/${slug}/documents/${documentId}`
  const response = await deleteRequest(url)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to delete document")
  }
}

export async function getDocumentStatus(
  slug: string,
  documentId: string
): Promise<Document> {
  requireAuthToken()
  const response = await getRequest(
    `${baseUrl}/${slug}/documents/${documentId}`
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch document status")
  }
  return response.data.data.document
}

export interface DocumentPreviewData {
  document: {
    id: string
    original_name: string
    mime_type: string
    size_bytes: number
    page_count: number | null
  }
  chunkContent: string
  pageNumber: number | null
  downloadUrl: string
  expiresIn: number
}

export async function getDocumentByMemory(
  slug: string,
  memoryId: string
): Promise<DocumentPreviewData> {
  requireAuthToken()
  const response = await getRequest(
    `${baseUrl}/${slug}/documents/by-memory/${memoryId}`
  )
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "No document found for this citation"
    )
  }
  return response.data.data
}

// Search
export async function searchOrganization(
  slug: string,
  query: string,
  options?: {
    limit?: number
    sourceTypes?: string[]
    includeAnswer?: boolean
  }
): Promise<OrganizationSearchResponse> {
  requireAuthToken()
  const response = await postRequest(
    `/search/organization/${slug}`,
    {
      query,
      limit: options?.limit || 20,
      sourceTypes: options?.sourceTypes,
      includeAnswer: options?.includeAnswer !== false,
    },
    undefined,
    undefined,
    30000 // 30 second timeout for initial search results
  )

  if (!response.data?.success) {
    throw new Error(response.data?.message || "Search failed")
  }
  return response.data.data
}

// Answer job result type
export interface AnswerJobResult {
  id: string
  status: "pending" | "completed" | "failed"
  answer?: string
  citations?: Array<{
    label: number
    memory_id: string
    title: string | null
    url: string | null
  }>
}

// Poll for answer job status (legacy, kept for fallback)
export async function getAnswerJobStatus(
  jobId: string
): Promise<AnswerJobResult> {
  requireAuthToken()
  const response = await getRequest(`/search/job/${jobId}`)
  return response.data
}

// Subscribe to answer job via SSE
export function subscribeToAnswerJob(
  jobId: string,
  callbacks: {
    onCompleted: (result: AnswerJobResult) => void
    onError: (error: string) => void
    onHeartbeat?: (elapsed: number) => void
  }
): () => void {
  // Build the SSE URL - bypass Vite proxy in dev mode to avoid buffering issues
  // SSE needs direct connection to avoid proxy buffering
  const baseUrl = import.meta.env.DEV
    ? "http://localhost:3000/api" // Direct connection in dev
    : `${import.meta.env.VITE_SERVER_URL || ""}/api`

  // Note: EventSource doesn't support custom headers, so we pass token as query param
  const token = localStorage.getItem("auth_token") || ""
  const url = `${baseUrl}/search/job/${jobId}/stream?token=${encodeURIComponent(token)}`

  console.log("[SSE] Connecting to:", url)
  const eventSource = new EventSource(url)

  eventSource.addEventListener("connected", () => {
    console.log("[SSE] Connected to answer stream", jobId)
  })

  eventSource.addEventListener("completed", (event) => {
    console.log("[SSE] Received completed event", event.data)
    try {
      const data = JSON.parse(event.data) as AnswerJobResult
      callbacks.onCompleted(data)
    } catch (err) {
      console.error("[SSE] Failed to parse completed event", err)
      callbacks.onError("Failed to parse response")
    }
    eventSource.close()
  })

  eventSource.addEventListener("failed", (event) => {
    console.log("[SSE] Received failed event", event.data)
    try {
      const data = JSON.parse(event.data)
      callbacks.onError(data.error || "Answer generation failed")
    } catch {
      callbacks.onError("Answer generation failed")
    }
    eventSource.close()
  })

  eventSource.addEventListener("timeout", (event) => {
    console.log("[SSE] Received timeout event", event.data)
    try {
      const data = JSON.parse(event.data)
      callbacks.onError(data.error || "Answer generation timed out")
    } catch {
      callbacks.onError("Answer generation timed out")
    }
    eventSource.close()
  })

  eventSource.addEventListener("error", (event) => {
    console.log("[SSE] Error event, readyState:", eventSource.readyState, event)
    if (eventSource.readyState === EventSource.CLOSED) {
      return // Normal close, ignore
    }
    console.error("[SSE] Connection error", event)
    callbacks.onError("Connection error")
    eventSource.close()
  })

  eventSource.addEventListener("heartbeat", (event) => {
    console.log("[SSE] Heartbeat", event.data)
    if (callbacks.onHeartbeat) {
      try {
        const data = JSON.parse(event.data)
        callbacks.onHeartbeat(data.elapsed)
      } catch {
        // Ignore parse errors for heartbeat
      }
    }
  })

  // Also listen for raw messages
  eventSource.onmessage = (event) => {
    console.log("[SSE] Raw message received:", event.data)
  }

  // Return cleanup function
  return () => {
    eventSource.close()
  }
}

export async function searchOrganizationDocuments(
  slug: string,
  query: string,
  limit?: number
): Promise<OrganizationSearchResponse> {
  requireAuthToken()
  const response = await postRequest(
    `/search/organization/${slug}/documents`,
    { query, limit: limit || 20 },
    undefined,
    undefined,
    120000
  )

  if (!response.data?.success) {
    throw new Error(response.data?.message || "Search failed")
  }
  return response.data.data
}

// Memories (for mesh visualization)
export async function getOrganizationMemories(
  slug: string,
  limit?: number
): Promise<OrganizationMemory[]> {
  requireAuthToken()
  const response = await getRequest(
    `${baseUrl}/${slug}/memories${limit ? `?limit=${limit}` : ""}`
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch memories")
  }
  return response.data.data.memories || []
}

export async function getOrganizationMemoryCount(
  slug: string
): Promise<number> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/memories/count`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch memory count")
  }
  return response.data.data.count || 0
}

export async function getOrganizationMesh(
  slug: string,
  limit?: number,
  threshold?: number
): Promise<OrganizationMesh> {
  requireAuthToken()
  const params = new URLSearchParams()
  if (limit) params.append("limit", limit.toString())
  if (threshold) params.append("threshold", threshold.toString())
  const queryString = params.toString()
  const response = await getRequest(
    `${baseUrl}/${slug}/mesh${queryString ? `?${queryString}` : ""}`
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch mesh")
  }
  const data = response.data.data
  // Transform to match MemoryMesh type
  return {
    nodes: data.nodes || [],
    edges: (data.edges || []).map(
      (edge: {
        source: string
        target: string
        relationship_type?: string
        relation_type?: string
        similarity_score: number
      }) => ({
        source: edge.source,
        target: edge.target,
        relation_type:
          edge.relation_type || edge.relationship_type || "semantic",
        similarity_score: edge.similarity_score,
      })
    ),
    clusters: data.clusters || {},
  }
}

// Type for organization mesh (compatible with MemoryMeshNode)
export interface OrganizationMeshNode {
  id: string
  x: number
  y: number
  z?: number
  type: string
  label: string
  memory_id: string
  title?: string
  url?: string
  source?: string
  preview?: string
  content?: string
  full_content?: string
  importance_score?: number
  hasEmbedding?: boolean
  clusterId?: number
  layout?: {
    isLatentSpace?: boolean
    cluster?: string
    centrality?: number
  }
}

export interface OrganizationMeshEdge {
  source: string
  target: string
  relation_type: string
  similarity_score: number
}

export interface OrganizationMesh {
  nodes: OrganizationMeshNode[]
  edges: OrganizationMeshEdge[]
  clusters?: { [clusterId: string]: string[] }
}

// Type for organization memories
export interface OrganizationMemory {
  id: string
  content: string
  embedding?: number[]
  created_at: string
  source?: string
  url?: string
  title?: string
  category?: string
  related_memories?: Array<{
    related_memory_id: string
    similarity_score: number
  }>
  related_to_memories?: Array<{
    memory_id: string
    similarity_score: number
  }>
}

// ==========================================
// Enterprise Setup Types
// ==========================================

export interface SetupProgress {
  completedSteps: string[]
  totalSteps: number
  percentComplete: number
  startedAt: string | null
  completedAt: string | null
}

export interface UpdateProfileRequest {
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

export interface UpdateBillingRequest {
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
  plan?: "free" | "pro" | "enterprise"
}

export interface UpdateSecurityRequest {
  dataResidency?: "auto" | "us" | "eu" | "asia-pacific"
  require2FA?: boolean
  sessionTimeout?: "1h" | "8h" | "24h" | "7d" | "30d"
  passwordPolicy?: "standard" | "strong" | "custom"
  auditRetention?: "30d" | "90d" | "365d" | "unlimited"
  ipAllowlist?: string[]
  ssoEnabled?: boolean
  ssoConfig?: {
    provider?: string
    ssoUrl?: string
    entityId?: string
    certificate?: string
  }
}

export interface Invitation {
  id: string
  organization_id: string
  email: string
  role: "ADMIN" | "EDITOR" | "VIEWER"
  invited_by: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface InvitationWithOrg extends Invitation {
  organization: {
    id: string
    name: string
    slug: string
    logo?: string
  }
}

// ==========================================
// Enterprise Setup API Functions
// ==========================================

export async function getSetupProgress(slug: string): Promise<SetupProgress> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/setup`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch setup progress")
  }
  return response.data.data.progress
}

export async function updateProfile(
  slug: string,
  data: UpdateProfileRequest
): Promise<Organization> {
  requireAuthToken()
  const { putRequest } = await import("../../utils/http")
  const response = await putRequest(`${baseUrl}/${slug}/profile`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update profile")
  }
  return response.data.data.organization
}

export async function updateBilling(
  slug: string,
  data: UpdateBillingRequest
): Promise<Organization> {
  requireAuthToken()
  const { putRequest } = await import("../../utils/http")
  const response = await putRequest(`${baseUrl}/${slug}/billing`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update billing")
  }
  return response.data.data.organization
}

export async function updateSecurity(
  slug: string,
  data: UpdateSecurityRequest
): Promise<Organization> {
  requireAuthToken()
  const { putRequest } = await import("../../utils/http")
  const response = await putRequest(`${baseUrl}/${slug}/security`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update security")
  }
  return response.data.data.organization
}

export async function skipSetupStep(slug: string, step: string): Promise<void> {
  requireAuthToken()
  const response = await postRequest(`${baseUrl}/${slug}/setup/skip`, { step })
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to skip step")
  }
}

export async function markSecurityPromptShown(slug: string): Promise<void> {
  requireAuthToken()
  const response = await postRequest(
    `${baseUrl}/${slug}/setup/security-prompt-shown`,
    {}
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to mark security prompt")
  }
}

// ==========================================
// Invitation API Functions
// ==========================================

export async function createInvitations(
  slug: string,
  emails: string[],
  role?: "ADMIN" | "EDITOR" | "VIEWER"
): Promise<{
  invitations: Invitation[]
  errors: Array<{ email: string; error: string }>
}> {
  requireAuthToken()
  const response = await postRequest(`${baseUrl}/${slug}/invitations`, {
    emails,
    role,
  })
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to create invitations")
  }
  return response.data.data
}

export async function getInvitations(slug: string): Promise<Invitation[]> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/invitations`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch invitations")
  }
  return response.data.data.invitations || []
}

export async function revokeInvitation(
  slug: string,
  invitationId: string
): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(
    `${baseUrl}/${slug}/invitations/${invitationId}`
  )
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to revoke invitation")
  }
}

export async function getInvitationByToken(
  token: string
): Promise<InvitationWithOrg> {
  requireAuthToken()
  const response = await getRequest(`/invitations/${token}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Invalid invitation")
  }
  return response.data.data.invitation
}

export async function acceptInvitation(token: string): Promise<Organization> {
  requireAuthToken()
  const response = await postRequest(`/invitations/${token}/accept`, {})
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to accept invitation")
  }
  return response.data.data.organization
}
