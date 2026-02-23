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
      <span className="text-sm font-mono text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`px-3 py-1 text-xs font-mono border transition-colors ${
          checked
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-500 border-gray-300 hover:bg-gray-100"
        }`}
      >
        {checked ? "ON" : "OFF"}
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
          <div key={i} className="h-8 bg-gray-200" />
        ))}
      </div>
    )
  }

  if (!preferences) return null

  return (
    <div className="bg-white border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wide">
          [PREFERENCES]
        </div>
        {saved && (
          <span className="text-xs font-mono text-gray-500">Saved</span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
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
          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            Digest Hour
          </label>
          <select
            value={preferences.digest_hour}
            onChange={(e) => update({ digest_hour: Number(e.target.value) })}
            className="w-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono text-gray-700"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            Timezone
          </label>
          <input
            type="text"
            value={preferences.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            placeholder="UTC"
            className="w-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono text-gray-700"
          />
        </div>
      </div>
    </div>
  )
}
