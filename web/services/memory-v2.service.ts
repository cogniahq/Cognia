"use client"

/**
 * Memory v2 service — thin wrapper around /api/memories/v2.
 *
 * Ported from client/src/services/memory-v2.service.ts. The shared fetchJSON
 * helper deliberately bypasses the axios apiClient because it needs to read
 * { success, message } envelopes from non-2xx responses without throwing,
 * matching the original behavior. The 401/403 redirect logic from
 * lib/api/client.ts is preserved here directly.
 */

import { env } from "@/lib/env"

const API_URL = env.publicApiUrl

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

interface ApiEnvelope {
  success?: boolean
  message?: string
  code?: string
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope &
    Record<string, unknown>
  if (
    res.status === 403 &&
    body?.code === "NO_ORG_MEMBERSHIP" &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/onboarding/workspace"
  ) {
    window.location.href = "/onboarding/workspace"
  }
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login"
  }
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
    organizationId?: string | null
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

export { fetchJSON }
