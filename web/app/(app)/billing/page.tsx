import type { Metadata } from "next"
import Script from "next/script"

import { BillingClient } from "@/components/billing/BillingClient"

/**
 * /billing — workspace plan + Razorpay checkout. Everything beyond the
 * page chrome is client-side because Razorpay Checkout is a window-level
 * SDK injected via <script>. We pre-load it via next/script with
 * `lazyOnload` so the SDK is ready by the time the user clicks "Upgrade",
 * and the lazy loader in lib/razorpay.ts is a fallback if it isn't.
 *
 * Permissions: any org member can open /billing — the API enforces
 * `billing.read` (granted to every role) for GET and `billing.manage` for
 * mutations, so a viewer who reaches the page can see the current plan
 * but the Cancel/Upgrade buttons will 403 server-side. We don't pre-gate
 * here to keep the read-only view available.
 */
export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
}

export default function BillingPage() {
  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <BillingClient />
    </>
  )
}
