/**
 * Phase 4 Slice D: Memory v2 service module.
 *
 * Wraps the cursor-paginated /api/memories/v2 endpoints introduced in
 * phases 4A-C. Kept separate from the legacy memory.service.ts so the
 * two can co-exist while UI gradually migrates to v2.
 */

const API_URL = import.meta.env.VITE_API_URL || ""

export interface MemoryV2 {
  id: string
  title?: string | null
  content?: string | null
  full_content?: string | null
  source?: string | null
  url?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  tags?: Array<{ id: string; name: string; color?: string | null }>
  workspace_id?: string | null
  [k: string]: unknown
}

export interface MemoryListResponse {
  success: boolean
  data: MemoryV2[]
  nextCursor: string | null
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || `Request failed: ${res.status}`)
  }
  return body as T
}

export const memoryV2Service = {
  list: (params: {
    cursor?: string
    limit?: number
    onlyDeleted?: boolean
    q?: string
  }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
    })
    return fetchJSON<MemoryListResponse>(`/api/memories/v2?${qs.toString()}`)
  },
  update: (
    id: string,
    patch: { title?: string; content?: string; full_content?: string }
  ) =>
    fetchJSON<{ success: boolean; data: MemoryV2 }>(`/api/memories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  delete: (id: string, hard = false) =>
    fetchJSON<{ success: boolean }>(
      `/api/memories/${id}${hard ? "?hard=true" : ""}`,
      { method: "DELETE" }
    ),
  bulkDelete: (ids: string[]) =>
    fetchJSON<{ success: boolean; deleted: number }>(
      `/api/memories/bulk-delete`,
      { method: "POST", body: JSON.stringify({ ids }) }
    ),
  restore: (id: string) =>
    fetchJSON<{ success: boolean }>(`/api/memories/${id}/restore`, {
      method: "POST",
    }),
}

// Shared fetchJSON helper exported for sibling v2 services to reuse.
export { fetchJSON }
