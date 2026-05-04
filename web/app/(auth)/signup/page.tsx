import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

/**
 * Registration surface. Reuses LoginForm with mode="signup" so the form
 * markup stays in one place and the two routes only differ in the action
 * the form posts to.
 */
export default async function SignupPage() {
  const session = await getSession();
  if (session) {
    redirect(
      session.organizations.length === 0
        ? "/onboarding/workspace"
        : "/organization",
    );
  }
  return <LoginForm mode="signup" />;
}
