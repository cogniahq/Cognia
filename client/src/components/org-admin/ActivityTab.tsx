import { useCallback, useEffect, useMemo, useState } from "react"
import { orgAdminService, type ActivityRow } from "@/services/org-admin.service"
import { Loader2 } from "lucide-react"

interface ActivityTabProps {
  slug: string
}

const PAGE_SIZE = 50

interface Filters {
  eventType: string
  eventCategory: string
  startDate: string
  endDate: string
}

const EMPTY_FILTERS: Filters = {
  eventType: "",
  eventCategory: "",
  startDate: "",
  endDate: "",
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ActivityTab({ slug }: ActivityTabProps) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS)

  const queryParams = useMemo<Record<string, string | number | undefined>>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      eventType: filters.eventType || undefined,
      eventCategory: filters.eventCategory || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    }),
    [offset, filters]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await orgAdminService.getActivity(slug, queryParams)
      setRows(res.data || [])
      setTotal(res.pagination?.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity")
    } finally {
      setIsLoading(false)
    }
  }, [slug, queryParams])

  useEffect(() => {
    load()
  }, [load])

  const handleApplyFilters = () => {
    setOffset(0)
    setFilters(pendingFilters)
  }

  const handleResetFilters = () => {
    setPendingFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setOffset(0)
  }

  const csvUrl = orgAdminService.activityCsvUrl(slug, {
    eventType: filters.eventType || undefined,
    eventCategory: filters.eventCategory || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  })

  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1">
              Event type
            </label>
            <input
              type="text"
              value={pendingFilters.eventType}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, eventType: e.target.value }))
              }
              placeholder="login_success"
              className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1">
              Category
            </label>
            <select
              value={pendingFilters.eventCategory}
              onChange={(e) =>
                setPendingFilters((f) => ({
                  ...f,
                  eventCategory: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-md bg-white"
            >
              <option value="">All</option>
              <option value="authentication">Authentication</option>
              <option value="authorization">Authorization</option>
              <option value="data_access">Data access</option>
              <option value="admin">Admin</option>
              <option value="security">Security</option>
              <option value="integration">Integration</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1">
              Start
            </label>
            <input
              type="date"
              value={pendingFilters.startDate}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, startDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1">
              End
            </label>
            <input
              type="date"
              value={pendingFilters.endDate}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, endDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-md"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApplyFilters}
            className="px-3 py-1.5 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors rounded-md"
          >
            Apply
          </button>
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 text-xs font-mono text-gray-600 border border-gray-300 hover:text-gray-900 hover:bg-gray-100 transition-colors rounded-md"
          >
            Reset
          </button>
          <a
            href={csvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto px-3 py-1.5 text-xs font-mono text-gray-600 border border-gray-300 hover:text-gray-900 hover:bg-gray-100 transition-colors rounded-md"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading activity...</span>
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-xs text-red-600 bg-red-50">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-sm font-mono text-gray-500">
              No activity yet
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Audit events will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-mono">When</th>
                  <th className="text-left px-4 py-2.5 font-mono">Event</th>
                  <th className="text-left px-4 py-2.5 font-mono">Category</th>
                  <th className="text-left px-4 py-2.5 font-mono">Actor</th>
                  <th className="text-left px-4 py-2.5 font-mono">Action</th>
                  <th className="text-left px-4 py-2.5 font-mono">Target</th>
                  <th className="text-left px-4 py-2.5 font-mono">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-gray-700 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-900">
                      {row.event_type}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {row.event_category}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {row.actor_email || row.user?.email || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{row.action}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">
                      {row.target_resource_type
                        ? `${row.target_resource_type}${row.target_resource_id ? `:${row.target_resource_id.slice(0, 8)}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono">
                      {row.ip_address || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="font-mono">
            {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)}{" "}
            of {total}
          </div>
          <div className="flex gap-2">
            <button
              disabled={!canPrev || isLoading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1.5 font-mono border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
            >
              Prev
            </button>
            <button
              disabled={!canNext || isLoading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1.5 font-mono border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
