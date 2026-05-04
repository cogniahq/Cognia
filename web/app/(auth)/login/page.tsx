import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Sign-in surface. If the visitor already has a valid session, bounce them
 * straight to /organization (or /onboarding/workspace when they have no org
 * yet) — same UX the old client/ Login page applied through useEffect.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(
      session.organizations.length === 0
        ? "/onboarding/workspace"
        : "/organization",
    );
  }
  return <LoginForm mode="signin" />;
}
