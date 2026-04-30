import { useEffect, useState } from "react"
import { gdprService } from "@/services/gdpr.service"

const STORAGE_KEY = "cognia.consent.v1"

export function CookieConsent() {
  const [shown, setShown] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(STORAGE_KEY)) setShown(true)
  }, [])

  if (!shown) return null

  const accept = (full: boolean) => {
    const consent = {
      cookies: true,
      analytics: full ? true : analytics,
      marketing: full ? true : marketing,
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...consent, at: new Date().toISOString() })
    )
    // best-effort if user is logged in; ignore errors for anonymous visitors
    gdprService.recordConsent(consent).catch(() => {})
    setShown(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-4 z-50">
      <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-2">
        Cookies & analytics
      </h3>
      <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
        We use strictly necessary cookies to operate the service. Optional
        analytics &amp; marketing cookies help us improve.
      </p>
      <div className="space-y-2 mb-3 text-sm text-gray-800 dark:text-zinc-200">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked disabled /> Strictly necessary
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
          />{" "}
          Analytics
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />{" "}
          Marketing
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-zinc-900 text-white text-sm hover:bg-zinc-800 transition-colors"
          onClick={() => accept(false)}
        >
          Save preferences
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-gray-300 dark:border-zinc-600 text-sm text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => accept(true)}
        >
          Accept all
        </button>
      </div>
    </div>
  )
}
