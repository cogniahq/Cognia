import "server-only";
import { cache } from "react";
import { apiFetch, ApiError } from "../api/server";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface SessionOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface Session {
  user: SessionUser;
  organizations: SessionOrganization[];
  /** First active organization, or null. Used as the default workspace context. */
  primaryOrg: SessionOrganization | null;
}

/**
 * Reads the current session. Cached per-request via React.cache so multiple
 * Server Components in the same render pass share one network call.
 *
 * Returns null if the user is unauthenticated. Throws on unexpected
 * errors (network failure, 500, etc.) so the error boundary catches them.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const me = await apiFetch<{ user: SessionUser }>("/api/auth/me");
    const orgsRes = await apiFetch<{ organizations: SessionOrganization[] }>(
      "/api/organizations/user/organizations",
    );
    const organizations = orgsRes.organizations ?? [];
    const primaryOrg = organizations.length > 0 ? organizations[0] : null;
    return { user: me.user, organizations, primaryOrg };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
});
