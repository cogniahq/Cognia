import type { Metadata } from "next";
import {
  AuthErrorView,
  AuthSuccessView,
} from "@/components/auth/AuthErrorView";
import { verifyEmailAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

/**
 * Email verification landing page. The user clicks the token link in their
 * inbox; we run the verification server-side and render success/error
 * inline so there's no client roundtrip and no token in the rendered HTML.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthErrorView
        title="Missing token"
        message="This URL doesn't include a verification token. Use the link from your email."
      />
    );
  }

  const result = await verifyEmailAction(token);
  if ("error" in result) {
    return (
      <AuthErrorView
        title="Verification failed"
        message={
          result.error ||
          "This link is invalid or expired. Request a new one from your account settings."
        }
      />
    );
  }

  return (
    <AuthSuccessView
      title="Email verified"
      message="Thanks for confirming your address. You can now use every workspace feature."
      cta={{ href: "/organization", label: "Continue" }}
    />
  );
}
