import type { Metadata } from "next"
import { Suspense } from "react"

import { IntegrationsClient } from "@/components/integrations/IntegrationsClient"

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
}

/**
 * Provider grid + Calendar OAuth banner. The list is fetched on the
 * client so it can react to ?connected=...&calendar=... query params
 * the OAuth callback bounces back with — server-rendering once and
 * then re-fetching on every popup return is wasted work.
 *
 * Suspense is required because IntegrationsClient calls useSearchParams,
 * which forces the route into dynamic rendering only when the params
 * are accessed.
 */
export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsClient />
    </Suspense>
  )
}
