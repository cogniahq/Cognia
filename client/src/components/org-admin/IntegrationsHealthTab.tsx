import { useCallback, useEffect, useState } from "react"
import {
  orgAdminService,
  type IntegrationHealth,
} from "@/services/org-admin.service"
import { Loader2 } from "lucide-react"

interface IntegrationsHealthTabProps {
  slug: string
}

const STATUS_STYLES: Record<
  string,
  { label: string; tone: "green" | "yellow" | "red" | "gray" }
> = {
  ACTIVE: { label: "Active", tone: "green" },
  CONNECTED: { label: "Connected", tone: "green" },
  PAUSED: { label: "Paused", tone: "yellow" },
  ERROR: { label: "Error", tone: "red" },
  RATE_LIMITED: { label: "Rate limited", tone: "red" },
  TOKEN_EXPIRED: { label: "Token expired", tone: "red" },
  DISCONNECTED: { label: "Disconnected", tone: "red" },
}

const TONE_CLASSES: Record<string, string> = {
  green: "border-green-200 bg-green-50 text-green-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-gray-200 bg-gray-50 text-gray-600",
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Never"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function IntegrationsHealthTab({
  slug,
}: IntegrationsHealthTabProps) {
  const [items, setItems] = useState<IntegrationHealth[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await orgAdminService.getIntegrationsHealth(slug)
      setItems(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load integrations"
      )
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-600 uppercase tracking-wide">
          [INTEGRATIONS] — {items.length} total
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors rounded-md disabled:opacity-50"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">
              Loading integrations...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-sm font-mono text-gray-500">
              No integrations connected
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Connected integrations and their health will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const style = STATUS_STYLES[item.status?.toUpperCase()] || {
                label: item.status || "Unknown",
                tone: "gray" as const,
              }
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 px-5 py-4 hover:bg-gray-50 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">
                        {item.display_name || item.provider}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${TONE_CLASSES[style.tone]}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 font-mono">
                      Last sync: {formatDate(item.last_sync_at)}
                      {item.user?.email && (
                        <span className="ml-3">· Owner: {item.user.email}</span>
                      )}
                    </div>
                    {item.last_error && (
                      <div className="mt-2 text-xs text-red-600 break-words">
                        <span className="font-mono uppercase tracking-wide text-[10px] text-red-500 mr-1.5">
                          Error
                        </span>
                        {item.last_error}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
