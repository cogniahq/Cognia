"use client";

/**
 * GDPR data-rights endpoints: schedule a 30-day deletion, cancel during
 * the grace period, check current status. Uses bare fetch (not the axios
 * apiClient) so the callsite isn't subject to the 401 redirect — the
 * status fetch is best-effort and may be called when the user is in a
 * pre-onboarding state where 401 is expected.
 */

import { env } from "@/lib/env";

interface GdprStatusResponse {
  success: boolean;
  data: { scheduledFor: string | null; underLegalHold: boolean };
}

interface GdprScheduleResponse {
  success: boolean;
  scheduledFor: string;
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.publicApiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as
    | { success?: boolean; message?: string }
    | Record<string, unknown>;
  if (!res.ok || (body as { success?: boolean })?.success === false) {
    const message = (body as { message?: string })?.message;
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return body as T;
}

export const gdprService = {
  scheduleDeletion: () =>
    fetchJSON<GdprScheduleResponse>(`/api/gdpr/delete-account`, {
      method: "POST",
    }),
  cancelDeletion: () =>
    fetchJSON<{ success: boolean }>(`/api/gdpr/cancel-deletion`, {
      method: "POST",
    }),
  getStatus: () => fetchJSON<GdprStatusResponse>(`/api/gdpr/delete-status`),
};
