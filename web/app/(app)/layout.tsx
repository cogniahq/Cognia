import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { SessionProvider } from "@/lib/auth/client"

/**
 * Authed shell. The middleware has already verified that a cognia_session
 * cookie exists; this layout calls the API to materialise the user + orgs
 * and hydrates the client SessionProvider.
 *
 * If the API rejects the cookie (expired session), redirect to /login.
 * If the user has no active org membership, redirect to /onboarding/workspace.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.organizations.length === 0) {
    redirect("/onboarding/workspace")
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-white">
        {/* PageHeader will be added in Phase 3 once the component is ported */}
        {children}
      </div>
    </SessionProvider>
  )
}
