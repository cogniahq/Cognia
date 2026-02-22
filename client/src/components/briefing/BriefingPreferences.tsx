import { useCallback, useEffect, useRef, useState } from "react"
import {
  getPreferences,
  updatePreferences,
} from "@/services/briefing/briefing.service"

import type { NotificationPreferences } from "@/types/briefing"

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${period}`
}

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}

export default function BriefingPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getPreferences()
      .then(setPreferences)
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback((updated: NotificationPreferences) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await updatePreferences(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        // silently handle
      }
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const update = (partial: Partial<NotificationPreferences>) => {
    if (!preferences) return
    const updated = { ...preferences, ...partial }
    setPreferences(updated)
    save(updated)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    )
  }

  if (!preferences) return null

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Briefing Preferences
        </h3>
        {saved && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Saved
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <ToggleRow
          label="Daily Digest"
          checked={preferences.daily_digest}
          onChange={(v) => update({ daily_digest: v })}
        />
        <ToggleRow
          label="Weekly Synthesis"
          checked={preferences.weekly_synthesis}
          onChange={(v) => update({ weekly_synthesis: v })}
        />
        <ToggleRow
          label="Trend Alerts"
          checked={preferences.trend_alerts}
          onChange={(v) => update({ trend_alerts: v })}
        />
        <ToggleRow
          label="Team Reports"
          checked={preferences.team_reports}
          onChange={(v) => update({ team_reports: v })}
        />
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Digest Hour
          </label>
          <select
            value={preferences.digest_hour}
            onChange={(e) => update({ digest_hour: Number(e.target.value) })}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Timezone
          </label>
          <input
            type="text"
            value={preferences.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            placeholder="UTC"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
          />
        </div>
      </div>
    </div>
  )
}
