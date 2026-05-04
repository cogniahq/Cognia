"use client";

// Billing service — wraps the backend Razorpay billing endpoints under
// /api/billing/:slug. We re-use the shared apiClient so the cookie auth
// + 401/403 redirect logic stays consistent with the rest of the app.
//
// 402 QUOTA_EXCEEDED responses are surfaced via a global window event so
// the (future) <QuotaExceededListener /> island can show an upgrade modal
// from anywhere in the app.

import type { AxiosError } from "axios";

import { apiClient } from "@/lib/api/client";

export const QUOTA_EXCEEDED_EVENT = "cognia:quota-exceeded";

export type QuotaExceededKind = "seats" | "memories" | "integrations";

export interface QuotaExceededDetail {
  quotaExceeded: QuotaExceededKind;
  current: number;
  limit: number;
  plan: string;
  message?: string;
}

export interface BillingSubscription {
  id?: string;
  status?: string;
  plan?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string | null;
}

export interface BillingUsageDetail {
  current: number;
  limit: number;
}

export interface BillingUsage {
  plan: string;
  usage: {
    seats: BillingUsageDetail;
    memories: BillingUsageDetail;
    integrations: BillingUsageDetail;
  };
}

export interface BillingInvoice {
  id: string;
  razorpay_invoice_id?: string;
  razorpay_payment_id?: string | null;
  status: string;
  amount_due_paise?: number;
  amount_paid_paise?: number;
  currency?: string;
  created_at?: string | null;
  hosted_url?: string | null;
  pdf_url?: string | null;
  // legacy/optional alias fields used by older UI code
  number?: string | null;
  amountDue?: number;
  amountPaid?: number;
  created?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
}

export interface BillingResponse {
  billingEnabled: boolean;
  provider?: string;
  publicKeyId?: string | null;
  subscription: BillingSubscription | null;
  usage: BillingUsage;
  invoices: BillingInvoice[];
}

function dispatchQuotaExceeded(detail: QuotaExceededDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<QuotaExceededDetail>(QUOTA_EXCEEDED_EVENT, { detail }),
    );
  } catch {
    // ignore
  }
}

interface QuotaExceededBody {
  code?: string;
  quotaExceeded?: QuotaExceededKind;
  current?: number;
  limit?: number;
  plan?: string;
  message?: string;
}

function rethrowAxios(err: unknown): never {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    (err as AxiosError).response
  ) {
    const ax = err as AxiosError<QuotaExceededBody>;
    const status = ax.response?.status;
    const body = ax.response?.data;
    if (
      status === 402 &&
      body?.code === "QUOTA_EXCEEDED" &&
      body.quotaExceeded
    ) {
      dispatchQuotaExceeded({
        quotaExceeded: body.quotaExceeded,
        current: body.current ?? 0,
        limit: body.limit ?? 0,
        plan: body.plan ?? "",
        message: body.message,
      });
    }
    const wrapped = new Error(
      body?.message || `Request failed: ${status ?? "?"}`,
    );
    (wrapped as Error & { status?: number; body?: unknown }).status = status;
    (wrapped as Error & { status?: number; body?: unknown }).body = body;
    throw wrapped;
  }
  throw err instanceof Error ? err : new Error(String(err));
}

async function unwrap<T>(promise: Promise<{ data: unknown }>): Promise<T> {
  try {
    const res = await promise;
    const data = res.data as { success?: boolean; message?: string } & T;
    if (data?.success === false) {
      throw new Error(data?.message || "Request failed");
    }
    return data as T;
  } catch (err) {
    rethrowAxios(err);
  }
}

export const billingService = {
  get: (slug: string) =>
    unwrap<{ success: boolean; data: BillingResponse }>(
      apiClient.get(`/billing/${slug}`),
    ),

  // Razorpay flow: server creates a subscription, returns its id + public
  // key. The client opens Razorpay Checkout JS with these values to collect
  // payment.
  checkout: (slug: string, planId: string, totalCount?: number) =>
    unwrap<{
      success: boolean;
      subscriptionId: string;
      shortUrl: string | null;
      status: string;
      keyId: string | null;
    }>(apiClient.post(`/billing/${slug}/checkout`, { planId, totalCount })),

  cancel: (slug: string, atCycleEnd = true) =>
    unwrap<{ success: boolean }>(
      apiClient.post(`/billing/${slug}/cancel`, { atCycleEnd }),
    ),

  pause: (slug: string) =>
    unwrap<{ success: boolean }>(apiClient.post(`/billing/${slug}/pause`, {})),

  resume: (slug: string) =>
    unwrap<{ success: boolean }>(apiClient.post(`/billing/${slug}/resume`, {})),
};

// Helper exposed for tests / advanced consumers that want to manually
// trigger the global modal.
export function emitQuotaExceeded(detail: QuotaExceededDetail) {
  dispatchQuotaExceeded(detail);
}
