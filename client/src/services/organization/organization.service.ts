import { requireAuthToken } from "../../utils/auth"
import { getRequest, postRequest, patchRequest, deleteRequest } from "../../utils/http"
import type {
  Organization,
  OrganizationWithRole,
  OrganizationMember,
  Document,
  CreateOrganizationRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  OrganizationSearchResponse,
} from "../../types/organization"

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

export async function getOrganization(slug: string): Promise<OrganizationWithRole> {
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
  const response = await patchRequest(`${baseUrl}/${slug}/members/${memberId}`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update member role")
  }
  return response.data.data.member
}

export async function removeMember(slug: string, memberId: string): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`${baseUrl}/${slug}/members/${memberId}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to remove member")
  }
}

// Document management
export async function getOrganizationDocuments(slug: string): Promise<Document[]> {
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

export async function deleteDocument(slug: string, documentId: string): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`${baseUrl}/${slug}/documents/${documentId}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to delete document")
  }
}

export async function getDocumentStatus(
  slug: string,
  documentId: string
): Promise<Document> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${slug}/documents/${documentId}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch document status")
  }
  return response.data.data.document
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
    120000 // 2 minute timeout for search
  )

  if (!response.data?.success) {
    throw new Error(response.data?.message || "Search failed")
  }
  return response.data.data
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

export async function getOrganizationMemoryCount(slug: string): Promise<number> {
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
    edges: (data.edges || []).map((edge: { source: string; target: string; relationship_type?: string; relation_type?: string; similarity_score: number }) => ({
      source: edge.source,
      target: edge.target,
      relation_type: edge.relation_type || edge.relationship_type || "semantic",
      similarity_score: edge.similarity_score,
    })),
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
