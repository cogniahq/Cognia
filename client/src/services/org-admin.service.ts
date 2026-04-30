import { axiosInstance } from "@/utils/http"

// ============ Types ============

export interface ActivityRow {
  id: string
  organization_id: string | null
  user_id: string | null
  actor_email: string | null
  event_type: string
  event_category: string
  action: string
  target_user_id: string | null
  target_resource_type: string | null
  target_resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user?: { id: string; email: string | null } | null
}

export interface ActivityResponse {
  success: boolean
  data: ActivityRow[]
  pagination: { total: number; limit: number; offset: number }
}

export interface AdminMember {
  id: string
  organization_id: string
  user_id: string
  role: "ADMIN" | "EDITOR" | "VIEWER"
  invited_at?: string | null
  joined_at?: string | null
  deactivated_at?: string | null
  user?: {
    id: string
    email: string | null
    two_factor_enabled?: boolean
  } | null
}

export interface SecurityStatus {
  twoFaEnrollment: {
    enabled: number
    total: number
    percentage: number
    required: boolean
  }
  sso: {
    enabled: boolean
    provider?: string | null
  }
  ipAllowlist: {
    enabled: boolean
    size: number
  }
  session: {
    timeout: number | null
  }
  audit: {
    retention: number | null
  }
  passwordPolicy?: Record<string, unknown> | null
  dataResidency?: string | null
}

export interface IntegrationHealth {
  id: string
  provider: string
  display_name?: string | null
  status: string
  last_sync_at?: string | null
  last_error?: string | null
  last_error_at?: string | null
  user_id?: string | null
  user?: { id: string; email: string | null } | null
}

// ============ Helpers ============

function unwrap<T>(response: {
  data: { success?: boolean; data?: T; message?: string; error?: string }
}): T {
  if (response.data?.success === false) {
    throw new Error(
      response.data?.message || response.data?.error || "Request failed"
    )
  }
  return response.data?.data as T
}

function buildQuery(
  params: Record<string, string | number | undefined>
): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

// ============ API ============

export const orgAdminService = {
  getActivity: async (
    slug: string,
    params: Record<string, string | number | undefined>
  ): Promise<ActivityResponse> => {
    const res = await axiosInstance.get(
      `/org-admin/${slug}/activity${buildQuery(params)}`
    )
    if (res.data?.success === false) {
      throw new Error(res.data?.message || "Failed to fetch activity")
    }
    return res.data as ActivityResponse
  },

  activityCsvUrl: (
    slug: string,
    params: Record<string, string | undefined>
  ): string => {
    // The dev server proxies /api to the backend. In prod we use VITE_SERVER_URL.
    const base = import.meta.env.DEV
      ? "/api"
      : `${import.meta.env.VITE_SERVER_URL || ""}/api`
    return `${base}/org-admin/${slug}/activity/export.csv${buildQuery(params)}`
  },

  getMembers: async (slug: string): Promise<AdminMember[]> => {
    const res = await axiosInstance.get(`/org-admin/${slug}/members`)
    return unwrap<AdminMember[]>(res) || []
  },

  getSecurityStatus: async (slug: string): Promise<SecurityStatus> => {
    const res = await axiosInstance.get(`/org-admin/${slug}/security-status`)
    return unwrap<SecurityStatus>(res)
  },

  getIntegrationsHealth: async (slug: string): Promise<IntegrationHealth[]> => {
    const res = await axiosInstance.get(
      `/org-admin/${slug}/integrations-health`
    )
    return unwrap<IntegrationHealth[]>(res) || []
  },

  offboardMember: async (
    slug: string,
    memberId: string,
    body: {
      hardDelete?: boolean
      reassignDocsToUserId?: string
      reason?: string
    }
  ): Promise<void> => {
    const res = await axiosInstance.post(
      `/org-admin/${slug}/members/${memberId}/offboard`,
      body
    )
    if (res.data?.success === false) {
      throw new Error(res.data?.message || "Failed to offboard member")
    }
  },
}
