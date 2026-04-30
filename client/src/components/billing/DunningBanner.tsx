import React, { useState } from "react"
import type { BillingSubscription } from "@/services/billing.service"

interface DunningBannerProps {
  subscription: BillingSubscription | null | undefined
  onUpdatePayment: () => void | Promise<void>
}

/**
 * Top-of-page banner shown when the org's subscription is in a dunning state.
 * For Razorpay this maps to `halted` (auto-charge has failed and Razorpay has
 * stopped retrying) and `pending`. Clicking the CTA re-runs the Razorpay
 * Checkout flow so the user can re-authorise payment.
 */
export const DunningBanner: React.FC<DunningBannerProps> = ({
  subscription,
  onUpdatePayment,
}) => {
  const [busy, setBusy] = useState(false)
  const status = subscription?.status?.toLowerCase()
  const showBanner =
    status === "halted" ||
    status === "pending" ||
    // Legacy Stripe statuses kept here so a transitional state is still surfaced
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"

  if (!showBanner) return null

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onUpdatePayment()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
      role="alert"
      data-testid="dunning-banner"
    >
      <svg
        className="w-5 h-5 flex-shrink-0 text-amber-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Your payment failed</div>
        <div className="text-xs sm:text-sm text-amber-800 mt-0.5">
          Update your payment method to avoid service interruption.
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={busy}
        className="px-3 py-2 text-xs font-mono uppercase tracking-wide border border-amber-700 text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {busy ? "Opening..." : "Update payment"}
      </button>
    </div>
  )
}

export default DunningBanner
