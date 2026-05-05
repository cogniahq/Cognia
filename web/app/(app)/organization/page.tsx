import type { Metadata } from "next"

import { getSession } from "@/lib/auth/session"
import { OrganizationClient } from "@/components/organization/OrganizationClient"

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
}

/**
 * Workspace landing — full client surface in OrganizationClient.
 *
 * The (app) layout already gates this on a valid session + non-empty org
 * memberships, so by the time this Server Component runs we always have a
 * user. We seed the client with the primary org's slug so the first paint
 * doesn't have to wait on /api/organizations/user/organizations to know
 * which workspace to show.
 */
export default async function OrganizationPage() {
  const session = await getSession()
  if (!session) return null // middleware + (app) layout already gate this.
  const initialOrgSlug = session.primaryOrg?.slug ?? null
  return <OrganizationClient initialOrgSlug={initialOrgSlug} />
}
