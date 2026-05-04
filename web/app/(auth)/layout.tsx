/**
 * Auth + onboarding pages. Public access; no app chrome but no marketing
 * chrome either — these are focused single-action surfaces.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
