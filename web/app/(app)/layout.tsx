import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SessionProvider } from "@/lib/auth/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExtensionAuthBridge } from "@/components/auth/ExtensionAuthBridge";

/**
 * Authed shell. The middleware verifies the cognia_session cookie's presence;
 * this layout calls the API to materialise the user + orgs and hydrates the
 * client SessionProvider so every (app)/ client island can read user/org
 * state synchronously without a useEffect-loop fetch.
 *
 * If the API rejects the cookie (expired session) → /login.
 * If the user has no active org membership → /onboarding/workspace.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.organizations.length === 0) {
    redirect("/onboarding/workspace");
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-white">
        <PageHeader />
        <main>{children}</main>
      </div>
      <ExtensionAuthBridge />
    </SessionProvider>
  );
}
