/**
 * Marketing + legal pages. No app chrome, no auth requirement. Each page
 * mounts its own Header + Footer (via LegalPageLayout for legal/security
 * surfaces, inline for the landing) so the layout stays a thin
 * background-color shell.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
