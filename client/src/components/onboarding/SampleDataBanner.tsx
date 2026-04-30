import React, { useState } from "react"
import { onboardingService } from "@/services/onboarding.service"

interface SampleDataBannerProps {
  /** Number of demo memories the user currently has. If 0, the banner hides. */
  demoMemoryCount?: number
  /** Called after the dismiss-demo endpoint succeeds. */
  onDismissed?: () => void
  /** Override the service for tests. */
  service?: typeof onboardingService
}

/**
 * Banner shown at the top of data-bearing pages while the user still has the
 * seeded DEMO memories. Clicking "Dismiss demo data" calls
 * `onboarding/dismiss-demo` which purges the seed rows server-side.
 */
export const SampleDataBanner: React.FC<SampleDataBannerProps> = ({
  demoMemoryCount,
  onDismissed,
  service = onboardingService,
}) => {
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hidden) return null
  if (typeof demoMemoryCount === "number" && demoMemoryCount <= 0) return null

  const handleDismiss = async () => {
    setBusy(true)
    setError(null)
    try {
      await service.dismissDemo()
      setHidden(true)
      onDismissed?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-amber-200 bg-amber-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <svg
          className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-sm text-amber-900">
          <span className="font-medium">These are demo memories</span> — capture
          your own as you browse, or dismiss the demo data to start fresh.
          {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        disabled={busy}
        className="self-start sm:self-auto px-3 py-1.5 text-xs font-mono border border-amber-300 text-amber-900 hover:bg-amber-100 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {busy ? "Dismissing..." : "Dismiss demo data"}
      </button>
    </div>
  )
}

export default SampleDataBanner
