"use client";

/**
 * Organization API client. Mirrors
 * client/src/services/organization/organization.service.ts. Trims out the
 * pieces ported in Phase 3 (admin setup forms, invitations) — only the
 * surface used by /organization is included here. Add functions back as
 * follow-up phases need them.
 */

import { apiClient } from "@/lib/api/client";
import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
} from "@/utils/http";
import type {
  CreateOrganizationRequest,
  Document,
  Organization,
  OrganizationMember,
  OrganizationSearchResponse,
  OrganizationWithRole,
} from "@/types/organization";

const baseUrl = "/organizations";

export async function createOrganization(
  data: CreateOrganizationRequest,
): Promise<Organization> {
  const response = await postRequest(baseUrl, data);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to create organization");
  }
  return response.data.data.organization;
}

export async function getUserOrganizations(): Promise<OrganizationWithRole[]> {
  const response = await getRequest(`${baseUrl}/user/organizations`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch organizations");
  }
  return response.data.data.organizations || [];
}

export async function getOrganization(
  slug: string,
): Promise<OrganizationWithRole> {
  const response = await getRequest(`${baseUrl}/${slug}`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Organization not found");
  }
  return response.data.data.organization;
}

export async function deleteOrganization(slug: string): Promise<void> {
  const response = await deleteRequest(`${baseUrl}/${slug}`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to delete organization");
  }
}

export async function getOrganizationMembers(
  slug: string,
): Promise<OrganizationMember[]> {
  const response = await getRequest(`${baseUrl}/${slug}/members`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch members");
  }
  return response.data.data.members || [];
}

export async function getOrganizationDocuments(
  slug: string,
): Promise<Document[]> {
  // The API defaults to limit=50; the original Vite client bumped it to
  // 500 so the documents tab shows the full library for typical workspaces.
  const response = await getRequest(`${baseUrl}/${slug}/documents?limit=500`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch documents");
  }
  return response.data.data.documents || [];
}

export async function uploadDocument(
  slug: string,
  file: File,
  metadata?: Record<string, unknown>,
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata) {
    formData.append("metadata", JSON.stringify(metadata));
  }
  // multipart bypasses the JSON wrappers in utils/http — use apiClient
  // directly with a generous timeout so large PDFs don't trip the default.
  const response = await apiClient.post(
    `${baseUrl}/${slug}/documents`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
    },
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to upload document");
  }
  return response.data.data.document;
}

export async function deleteDocument(
  slug: string,
  documentId: string,
  type?: "document" | "integration",
): Promise<void> {
  const url =
    type === "integration"
      ? `${baseUrl}/${slug}/documents/${documentId}?type=integration`
      : `${baseUrl}/${slug}/documents/${documentId}`;
  const response = await deleteRequest(url);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to delete document");
  }
}

export async function getDocumentStatus(
  slug: string,
  documentId: string,
): Promise<Document> {
  const response = await getRequest(
    `${baseUrl}/${slug}/documents/${documentId}`,
  );
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "Failed to fetch document status",
    );
  }
  return response.data.data.document;
}

export interface DocumentPreviewData {
  document: {
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    page_count: number | null;
  };
  chunkContent: string;
  pageNumber: number | null;
  downloadUrl: string;
  expiresIn: number;
}

export async function getDocumentByMemory(
  slug: string,
  memoryId: string,
): Promise<DocumentPreviewData> {
  const response = await getRequest(
    `${baseUrl}/${slug}/documents/by-memory/${memoryId}`,
  );
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "No document found for this citation",
    );
  }
  return response.data.data;
}

export async function searchOrganization(
  slug: string,
  query: string,
  options?: {
    limit?: number;
    sourceTypes?: string[];
    includeAnswer?: boolean;
  },
): Promise<OrganizationSearchResponse> {
  const response = await postRequest(
    `/search/organization/${slug}`,
    {
      query,
      limit: options?.limit,
      sourceTypes: options?.sourceTypes,
      includeAnswer: options?.includeAnswer !== false,
    },
    undefined,
    undefined,
    30000,
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Search failed");
  }
  return response.data.data;
}

export interface AnswerJobResult {
  id: string;
  status: "pending" | "completed" | "failed";
  answer?: string;
  citations?: Array<{
    label: number;
    memory_id: string;
    title: string | null;
    url: string | null;
    source_type: string | null;
    author_email?: string | null;
    captured_at?: string | null;
  }>;
}

export async function getAnswerJobStatus(
  jobId: string,
): Promise<AnswerJobResult> {
  const response = await getRequest(`/search/job/${jobId}`);
  return response.data;
}

// Mesh ---------------------------------------------------------------------

export interface OrganizationMeshNode {
  id: string;
  x: number;
  y: number;
  z?: number;
  type: string;
  label: string;
  memory_id: string;
  title?: string;
  url?: string;
  source?: string;
  preview?: string;
  content?: string;
  full_content?: string;
  importance_score?: number;
  hasEmbedding?: boolean;
  clusterId?: number;
}

export interface OrganizationMeshEdge {
  source: string;
  target: string;
  relation_type: string;
  similarity_score: number;
}

export interface OrganizationMesh {
  nodes: OrganizationMeshNode[];
  edges: OrganizationMeshEdge[];
  clusters?: { [clusterId: string]: string[] };
}

export async function getOrganizationMesh(
  slug: string,
  limit?: number,
  threshold?: number,
): Promise<OrganizationMesh> {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (threshold) params.append("threshold", threshold.toString());
  const queryString = params.toString();
  const response = await getRequest(
    `${baseUrl}/${slug}/mesh${queryString ? `?${queryString}` : ""}`,
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch mesh");
  }
  const data = response.data.data;
  return {
    nodes: data.nodes || [],
    edges: (data.edges || []).map(
      (edge: {
        source: string;
        target: string;
        relationship_type?: string;
        relation_type?: string;
        similarity_score: number;
      }) => ({
        source: edge.source,
        target: edge.target,
        relation_type:
          edge.relation_type || edge.relationship_type || "semantic",
        similarity_score: edge.similarity_score,
      }),
    ),
    clusters: data.clusters || {},
  };
}

// Sync settings (used by /organization Settings tab) -----------------------

export interface OrgSyncSettings {
  defaultSyncFrequency: string;
  customSyncIntervalMin: number | null;
  effectiveIntervalMin: number;
}

export async function getOrgIntegrationSettings(
  slug: string,
): Promise<OrgSyncSettings> {
  const response = await getRequest(`${baseUrl}/${slug}/integration-settings`);
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "Failed to load integration settings",
    );
  }
  return response.data.data;
}

export async function updateOrgIntegrationSettings(
  slug: string,
  settings: {
    defaultSyncFrequency: string;
    customSyncIntervalMin: number | null;
  },
): Promise<OrgSyncSettings> {
  const response = await patchRequest(
    `${baseUrl}/${slug}/integration-settings`,
    settings,
  );
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "Failed to update integration settings",
    );
  }
  return response.data.data;
}

export interface SetupProgress {
  completedSteps: string[];
  totalSteps: number;
  percentComplete: number;
  startedAt: string | null;
  completedAt: string | null;
}

export async function getSetupProgress(slug: string): Promise<SetupProgress> {
  const response = await getRequest(`${baseUrl}/${slug}/setup`);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch setup progress");
  }
  return response.data.data.progress;
}
