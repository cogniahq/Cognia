import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthErrorView } from "@/components/auth/AuthErrorView";
import { magicLinkAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

/**
 * Magic-link consumption page. The link from the user's inbox lands here
 * with ?token=...; we consume it server-side and forward the cookie before
 * redirecting into the app. On failure we render a static error view so the
 * user can request a fresh link.
 */
export default async function MagicAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthErrorView
        title="Missing token"
        message="This URL doesn't include a sign-in token. Use the link from your email."
      />
    );
  }

  const result = await magicLinkAction(token);
  if (result?.error) {
    return (
      <AuthErrorView title="Sign-in link expired" message={result.error} />
    );
  }

  redirect("/organization");
}
