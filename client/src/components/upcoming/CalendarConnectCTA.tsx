import { useEffect, useState } from "react"
import { calendarService } from "@/services/calendar.service"
import { Calendar, CheckCircle2, Loader2 } from "lucide-react"

interface CalendarConnectCTAProps {
  /** Called whenever the connection status flips. Parent uses it to refresh row CTAs. */
  onConnectedChange?: (connected: boolean) => void
}

/**
 * Banner shown if the user hasn't connected Google Calendar. Opens the
 * OAuth flow in a popup; we poll the connection status while the popup
 * is open and resolve when the backend reports connected=true.
 */
export function CalendarConnectCTA({
  onConnectedChange,
}: CalendarConnectCTAProps) {
  const [status, setStatus] = useState<{
    connected: boolean
    configured: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    calendarService
      .status()
      .then((res) => {
        if (cancelled) return
        setStatus(res.data)
        onConnectedChange?.(res.data.connected)
      })
      .catch(() => {
        if (cancelled) return
        setStatus({ connected: false, configured: false })
      })
    return () => {
      cancelled = true
    }
  }, [onConnectedChange])

  const handleConnect = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await calendarService.authUrl()
      const popup = window.open(
        data.url,
        "cognia-calendar-oauth",
        "width=520,height=640"
      )
      if (!popup) {
        setError("Popup blocked — allow popups and try again.")
        setBusy(false)
        return
      }
      // Poll until the popup closes OR the backend reports connected.
      const poll = window.setInterval(async () => {
        try {
          const fresh = await calendarService.status()
          if (fresh.data.connected) {
            window.clearInterval(poll)
            setStatus(fresh.data)
            onConnectedChange?.(true)
            setBusy(false)
            try {
              popup.close()
            } catch {
              // ignore
            }
          } else if (popup.closed) {
            window.clearInterval(poll)
            setBusy(false)
          }
        } catch {
          // ignore transient
        }
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth")
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await calendarService.disconnect()
      setStatus((s) => (s ? { ...s, connected: false } : s))
      onConnectedChange?.(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking calendar status...
      </div>
    )
  }

  if (!status.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-mono text-amber-900">
        Calendar integration is not configured on this server. Ask an admin to
        set <code className="px-1 bg-amber-100 rounded">GOOGLE_CALENDAR_CLIENT_ID</code>.
      </div>
    )
  }

  if (status.connected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-mono text-emerald-900">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Google Calendar connected.
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={busy}
          className="text-emerald-700 hover:text-emerald-900 underline disabled:opacity-50"
        >
          {busy ? "..." : "Disconnect"}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-gray-700 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            Connect Google Calendar
          </div>
          <p className="mt-1 text-xs text-gray-600">
            One-click "Add to Calendar" on any extracted upcoming item.
          </p>
          {error && (
            <p className="mt-2 text-xs text-red-700 font-mono">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-mono text-white bg-gray-900 hover:bg-gray-700 rounded-md disabled:opacity-50"
        >
          {busy ? "Connecting..." : "Connect"}
        </button>
      </div>
    </div>
  )
}

export default CalendarConnectCTA
