import React, { useState } from "react"
import { onboardingService } from "@/services/onboarding.service"

interface GuidedTourStep {
  title: string
  body: string
  cta?: string
  href?: string
}

const STEPS: GuidedTourStep[] = [
  {
    title: "Search the demo memories",
    body: "Open the spotlight (⌘K) and search for anything — Cognia answers with citations from the sample data we've seeded for you.",
    cta: "Try a search",
  },
  {
    title: "Click a citation",
    body: "Citations link back to the source memory. Click one to see where the answer came from and how Cognia weighs context.",
    cta: "Got it",
  },
  {
    title: "Install the browser extension",
    body: "The extension captures the pages you actually visit so your real memory mesh starts forming. You can dismiss the demo data once you've captured your own.",
    cta: "Install the extension",
    href: "https://chromewebstore.google.com/search/cognia",
  },
]

interface GuidedTourOverlayProps {
  open?: boolean
  onClose?: () => void
  /** Override the service for tests. */
  service?: typeof onboardingService
}

/**
 * Three-step guided tour overlay shown to brand-new users. Dismissal calls
 * /onboarding/tour-completed so it doesn't reappear.
 */
export const GuidedTourOverlay: React.FC<GuidedTourOverlayProps> = ({
  open = true,
  onClose,
  service = onboardingService,
}) => {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(false)

  if (!open || closed) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const finish = async () => {
    setBusy(true)
    try {
      await service.tourCompleted()
    } catch {
      // best-effort; closing anyway
    } finally {
      setBusy(false)
      setClosed(true)
      onClose?.()
    }
  }

  const handlePrimary = () => {
    if (current.href) {
      window.open(current.href, "_blank", "noopener,noreferrer")
    }
    if (isLast) {
      void finish()
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="bg-white border border-gray-200 shadow-xl max-w-md w-full p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
            Tour · Step {step + 1} of {STEPS.length}
          </div>
          <button
            onClick={() => void finish()}
            disabled={busy}
            className="text-xs font-mono text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50"
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>

        <h2 className="text-xl sm:text-2xl font-light font-editorial text-gray-900 mb-2">
          {current.title}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          {current.body}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-8 bg-gray-900" : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0 || busy}
            className="text-xs font-mono text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handlePrimary}
            disabled={busy}
            className="px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-black transition-colors disabled:opacity-50"
          >
            {busy ? "Saving..." : current.cta || (isLast ? "Finish" : "Next")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuidedTourOverlay
