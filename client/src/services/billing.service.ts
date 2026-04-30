/* eslint-disable @typescript-eslint/no-explicit-any */
// Billing service — wraps the Phase 5A backend endpoints under /api/billing/:slug.
//
// We use a small fetch-based wrapper (rather than the shared axios instance) so
// we can inspect 402 QUOTA_EXCEEDED bodies and dispatch a global event that the
// <QuotaExceededListener /> can react to.
//
// The API base URL resolution mirrors `axios-interceptor.util.ts` so we honour
// both Vite dev proxy and prod `VITE_SERVER_URL`.

const API_BASE = import.meta.env.DEV
  ? "/api"
  : `${import.meta.env.VITE_SERVER_URL || ""}/api`

export const QUOTA_EXCEEDED_EVENT = "cognia:quota-exceeded"

export type QuotaExceededKind = "seats" | "memories" | "integrations"

export interface QuotaExceededDetail {
  quotaExceeded: QuotaExceededKind
  current: number
  limit: number
  plan: string
  message?: string
}

export interface BillingSubscription {
  id?: string
  status?: string
  plan?: string
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  trialEnd?: string | null
}

export interface BillingUsageDetail {
  current: number
  limit: number
}

export interface BillingUsage {
  plan: string
  usage: {
    seats: BillingUsageDetail
    memories: BillingUsageDetail
    integrations: BillingUsageDetail
  }
}

export interface BillingInvoice {
  id: string
  number?: string | null
  status: string
  amountDue?: number
  amountPaid?: number
  currency?: string
  created?: string | null
  hostedInvoiceUrl?: string | null
  invoicePdf?: string | null
}

export interface BillingResponse {
  billingEnabled: boolean
  subscription: BillingSubscription | null
  usage: BillingUsage
  invoices: BillingInvoice[]
}

function dispatchQuotaExceeded(detail: QuotaExceededDetail) {
  try {
    window.dispatchEvent(
      new CustomEvent<QuotaExceededDetail>(QUOTA_EXCEEDED_EVENT, { detail })
    )
  } catch {
    // ignore
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string> | undefined) || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  })

  let body: any = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }

  // 402 quota-exceeded — broadcast a global event so the listener can show the
  // upgrade modal anywhere in the app.
  if (res.status === 402 && body?.code === "QUOTA_EXCEEDED") {
    dispatchQuotaExceeded({
      quotaExceeded: body.quotaExceeded,
      current: body.current,
      limit: body.limit,
      plan: body.plan,
      message: body.message,
    })
  }

  if (!res.ok || body?.success === false) {
    const err = new Error(body?.message || `Request failed: ${res.status}`)
    ;(err as any).status = res.status
    ;(err as any).body = body
    throw err
  }
  return body as T
}

export const billingService = {
  get: (slug: string) =>
    fetchJSON<{ success: boolean; data: BillingResponse }>(
      `/billing/${slug}`
    ),

  checkout: (
    slug: string,
    priceId: string,
    successUrl?: string,
    cancelUrl?: string
  ) =>
    fetchJSON<{ success: boolean; url: string }>(
      `/billing/${slug}/checkout`,
      {
        method: "POST",
        body: JSON.stringify({ priceId, successUrl, cancelUrl }),
      }
    ),

  portal: (slug: string, returnUrl?: string) =>
    fetchJSON<{ success: boolean; url: string }>(`/billing/${slug}/portal`, {
      method: "POST",
      body: JSON.stringify({ returnUrl }),
    }),
}

// Helper exposed for tests / advanced consumers that want to manually trigger
// the global modal.
export function emitQuotaExceeded(detail: QuotaExceededDetail) {
  dispatchQuotaExceeded(detail)
}
