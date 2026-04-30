const API_URL = import.meta.env.VITE_API_URL || ""

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || `Request failed: ${res.status}`)
  }
  return body
}

export const gdprService = {
  scheduleDeletion: () =>
    fetchJSON<{ success: boolean; scheduledFor: string }>(
      `/api/gdpr/delete-account`,
      { method: "POST" }
    ),
  cancelDeletion: () =>
    fetchJSON<{ success: boolean }>(`/api/gdpr/cancel-deletion`, {
      method: "POST",
    }),
  getStatus: () =>
    fetchJSON<{
      success: boolean
      data: { scheduledFor: string | null; underLegalHold: boolean }
    }>(`/api/gdpr/delete-status`),
  recordConsent: (consent: {
    cookies: boolean
    analytics: boolean
    marketing: boolean
  }) =>
    fetchJSON<{ success: boolean }>(`/api/gdpr/consent`, {
      method: "POST",
      body: JSON.stringify(consent),
    }),
}
