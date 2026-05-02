import { requireAuthToken } from "../../utils/auth"
import { deleteRequest, getRequest, postRequest } from "../../utils/http"

const baseUrl = "/api-keys"

/**
 * Metadata for an API key as returned by the list/create endpoints.
 *
 * NOTE: the backend never returns `key_hash` to the client. The plaintext
 * `token` is only ever returned by `createApiKey()` (one-time only) and is
 * carried as `ApiKeyWithPlaintext.token` below.
 */
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

/** Returned ONCE on creation: includes the plaintext bearer token. */
export interface ApiKeyWithPlaintext extends ApiKeyMetadata {
  /** Plaintext token, e.g. `ck_live_…`. Returned only at creation time. */
  token: string
}

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  organizationId?: string
}

/**
 * Valid API key scopes — must match `VALID_SCOPES` in
 * api/src/routes/api-keys.route.ts. Keep this list in sync with the
 * backend whitelist; the server rejects unknown scopes.
 */
export const VALID_SCOPES = ["memories.read", "memories.write", "search"] as const
export type ApiKeyScope = (typeof VALID_SCOPES)[number]

export const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  "memories.read": "Read memories via /v1/memories",
  "memories.write": "Update or delete memories via /v1/memories",
  search: "Run hybrid search via /v1/search",
}

/** GET /api/api-keys — list the current user's personal + org keys. */
export async function listApiKeys(
  organizationId?: string
): Promise<ApiKeyMetadata[]> {
  requireAuthToken()
  const url = organizationId
    ? `${baseUrl}?organizationId=${encodeURIComponent(organizationId)}`
    : baseUrl
  const response = await getRequest(url)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to load API keys")
  }
  return (response.data.data as ApiKeyMetadata[]) || []
}

/** POST /api/api-keys — create a new API key. Plaintext is returned ONCE. */
export async function createApiKey(
  input: CreateApiKeyInput
): Promise<ApiKeyWithPlaintext> {
  requireAuthToken()
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

/** DELETE /api/api-keys/:id — revoke (sets `revoked_at`). */
export async function revokeApiKey(id: string): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`${baseUrl}/${id}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to revoke API key")
  }
}
