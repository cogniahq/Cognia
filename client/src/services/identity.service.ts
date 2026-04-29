// Identity service — wraps OAuth, magic links, SSO discovery, email
// verification, and SCIM token management endpoints. Uses native fetch with
// `credentials: 'include'` so the refresh cookie round-trips automatically.

const API_BASE = import.meta.env.DEV
  ? "/api"
  : `${import.meta.env.VITE_SERVER_URL || ""}/api`

function getAuthHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem("auth_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers || {}),
    },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  const b = body as {
    success?: boolean
    message?: string
    error?: string
    detail?: string
  }
  if (!res.ok || b?.success === false) {
    throw new Error(
      b?.message || b?.error || b?.detail || `Request failed: ${res.status}`
    )
  }
  return body as T
}

// ============ Types ============

export interface SsoDiscoveryResult {
  ssoAvailable: boolean
  enforced?: boolean
  orgSlug?: string
  orgName?: string
  loginUrl?: string
}

export interface ScimToken {
  id: string
  prefix: string
  name?: string | null
  created_at?: string
  last_used_at?: string | null
  revoked_at?: string | null
}

export interface CreatedScimToken extends ScimToken {
  token: string
}

// ============ Service ============

export const identityService = {
  // ---- SSO discovery ----
  discoverSso: (email: string) =>
    fetchJSON<SsoDiscoveryResult>("/sso/discover", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // ---- Magic link ----
  sendMagicLink: (email: string) =>
    fetchJSON<{ success: boolean }>("/auth/magic-link/send", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  consumeMagicLink: (token: string) =>
    fetchJSON<{ success: boolean; token?: string; data?: { token: string } }>(
      "/auth/magic-link/consume",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      }
    ),

  // ---- Email verification ----
  verifyEmail: (token: string) =>
    fetchJSON<{ success: boolean }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    fetchJSON<{ success: boolean }>("/auth/resend-verification", {
      method: "POST",
    }),

  // ---- OAuth ----
  oauthStart: (provider: "google" | "microsoft", returnTo?: string) => {
    const url = new URL(
      `${API_BASE}/auth/oauth/${provider}/start`,
      window.location.origin
    )
    if (returnTo) url.searchParams.set("returnTo", returnTo)
    window.location.href = url.toString()
  },

  // ---- SCIM token management (org admin) ----
  listScimTokens: (slug: string) =>
    fetchJSON<{ success: boolean; data: ScimToken[] }>(
      `/org-admin/${slug}/scim/tokens`
    ),

  createScimToken: (slug: string, name?: string) =>
    fetchJSON<{ success: boolean; data: CreatedScimToken }>(
      `/org-admin/${slug}/scim/tokens`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    ),

  revokeScimToken: (slug: string, tokenId: string) =>
    fetchJSON<{ success: boolean }>(
      `/org-admin/${slug}/scim/tokens/${tokenId}`,
      { method: "DELETE" }
    ),

  // ---- SSO config (org admin) ----
  // Updates the SSO configuration columns on the organization. Calls the
  // existing security update endpoint; backend may also expose a dedicated
  // /sso endpoint — try both gracefully so the wizard succeeds either way.
  updateSso: async (
    slug: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean }> => {
    try {
      return await fetchJSON<{ success: boolean }>(
        `/organizations/${slug}/sso`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      )
    } catch {
      return await fetchJSON<{ success: boolean }>(
        `/organizations/${slug}/security`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      )
    }
  },

  samlMetadataUrl: (slug: string) => `${API_BASE}/sso/saml/${slug}/metadata`,
}
