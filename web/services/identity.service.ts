"use client";

// Identity service — subset used by org-admin. Wraps the SCIM token + SSO
// configuration endpoints. Auth flows (magic link, email verification,
// OAuth) are handled by Server Actions in lib/auth/actions.ts in the
// Next.js app, so they are not duplicated here.

import { apiClient } from "@/lib/api/client";
import { env } from "@/lib/env";

const API_BASE = `${env.publicApiUrl}/api`;

// ============ Types ============

export interface ScimToken {
  id: string;
  prefix: string;
  name?: string | null;
  created_at?: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface CreatedScimToken extends ScimToken {
  token: string;
}

// ============ Service ============

export const identityService = {
  // ---- SCIM token management (org admin) ----
  listScimTokens: async (
    slug: string,
  ): Promise<{ success: boolean; data: ScimToken[] }> => {
    const res = await apiClient.get(`/org-admin/${slug}/scim/tokens`);
    if (res.data?.success === false) {
      throw new Error(res.data?.message || "Failed to list SCIM tokens");
    }
    return res.data as { success: boolean; data: ScimToken[] };
  },

  createScimToken: async (
    slug: string,
    name?: string,
  ): Promise<{ success: boolean; data: CreatedScimToken }> => {
    const res = await apiClient.post(`/org-admin/${slug}/scim/tokens`, {
      name,
    });
    if (res.data?.success === false) {
      throw new Error(res.data?.message || "Failed to create SCIM token");
    }
    return res.data as { success: boolean; data: CreatedScimToken };
  },

  revokeScimToken: async (
    slug: string,
    tokenId: string,
  ): Promise<{ success: boolean }> => {
    const res = await apiClient.delete(
      `/org-admin/${slug}/scim/tokens/${tokenId}`,
    );
    if (res.data?.success === false) {
      throw new Error(res.data?.message || "Failed to revoke SCIM token");
    }
    return res.data as { success: boolean };
  },

  // ---- SSO config (org admin) ----
  // Updates the SSO configuration columns on the organization. Calls the
  // dedicated /sso endpoint first, falls back to the /security endpoint
  // for older deployments.
  updateSso: async (
    slug: string,
    payload: Record<string, unknown>,
  ): Promise<{ success: boolean }> => {
    try {
      const res = await apiClient.patch(
        `/organizations/${slug}/sso`,
        payload,
      );
      if (res.data?.success === false) {
        throw new Error(res.data?.message || "Failed to save SSO config");
      }
      return res.data as { success: boolean };
    } catch {
      const res = await apiClient.patch(
        `/organizations/${slug}/security`,
        payload,
      );
      if (res.data?.success === false) {
        throw new Error(res.data?.message || "Failed to save SSO config");
      }
      return res.data as { success: boolean };
    }
  },

  // SAML SP metadata is downloaded directly from the API origin; surface
  // the absolute URL since this is loaded as <a href>.
  samlMetadataUrl: (slug: string): string =>
    `${API_BASE}/sso/saml/${slug}/metadata`,
};
