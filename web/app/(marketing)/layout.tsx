/**
 * Marketing + legal pages. No app chrome, no auth requirement.
 * Phase 1 will populate this with the marketing Header + Footer.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-white">{children}</div>
}
