import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { OrgAdminClient } from "@/components/org-admin/OrgAdminClient";

/**
 * Workspace admin console. The page-level Server Component does two
 * things:
 *   1. Resolves the slug → org membership from the SSR'd session and
 *      404s if the user isn't a member at all.
 *   2. Derives role-based booleans (canSeeApiKeys, canManageMembers,
 *      etc.) and hands them to the client island, so the tabs UI never
 *      has to round-trip /auth/me to gate itself.
 *
 * The matching backend routes still enforce permissions on every call,
 * so the client booleans are advisory — they hide UI but the API will
 * still 403 if a non-admin somehow reaches the endpoint.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} · Admin`,
    robots: { index: false, follow: false },
  };
}

export default async function OrgAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) return null; // (app) layout redirects before we get here

  const org = session.organizations.find((o) => o.slug === slug);
  if (!org) {
    // The session has organizations but the slug doesn't belong to any of
    // them. 404 keeps the URL space clean rather than leaking a "you don't
    // have access" hint.
    notFound();
  }

  const isAdmin = org.role === "ADMIN";
  const isEditor = org.role === "EDITOR";
  // The matrix mirrors api/src/services/auth/permissions.config.ts:
  //   - api_key.create + api_key.revoke → ADMIN only
  //   - audit.read → ADMIN, EDITOR, VIEWER (everyone in the org)
  //   - member.remove → ADMIN only
  const canManageMembers = isAdmin;
  const canSeeApiKeys = isAdmin;
  const canSeeUpcomingTab = isAdmin || isEditor || org.role === "VIEWER";

  return (
    <OrgAdminClient
      slug={slug}
      orgName={org.name}
      orgId={org.id}
      canManageMembers={canManageMembers}
      canSeeApiKeys={canSeeApiKeys}
      canSeeUpcomingTab={canSeeUpcomingTab}
    />
  );
}
