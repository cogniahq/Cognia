"use client"

import { deleteRequest, getRequest, postRequest } from "@/utils/http"

const baseUrl = "/api-keys"

export interface ApiKeyMetadata {
  id: string
  name: string
  prefix: string
  scopes: string[]
  organization_id: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ApiKeyWithPlaintext extends ApiKeyMetadata {
  /** Plaintext token, e.g. `ck_live_…`. Returned only at creation time. */
  token: string
}

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  organizationId?: string
}

export const VALID_SCOPES = [
  "memories.read",
  "memories.write",
  "search",
] as const
export type ApiKeyScope = (typeof VALID_SCOPES)[number]

export const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  "memories.read": "Read memories via /v1/memories",
  "memories.write": "Update or delete memories via /v1/memories",
  search: "Run hybrid search via /v1/search",
}

export async function listApiKeys(
  organizationId?: string
): Promise<ApiKeyMetadata[]> {
  const url = organizationId
    ? `${baseUrl}?organizationId=${encodeURIComponent(organizationId)}`
    : baseUrl
  const response = await getRequest(url)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to load API keys")
  }
  return (response.data.data as ApiKeyMetadata[]) || []
}

export async function createApiKey(
  input: CreateApiKeyInput
): Promise<ApiKeyWithPlaintext> {
  const response = await postRequest(baseUrl, {
    name: input.name,
    scopes: input.scopes,
    organizationId: input.organizationId,
  })
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to create API key")
  }
  return response.data.data as ApiKeyWithPlaintext
}

export async function revokeApiKey(id: string): Promise<void> {
  const response = await deleteRequest(`${baseUrl}/${id}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to revoke API key")
  }
}
