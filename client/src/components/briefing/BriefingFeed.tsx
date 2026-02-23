import { useCallback, useEffect, useState } from "react"
import {
  generateNow,
  listBriefings,
} from "@/services/briefing/briefing.service"

import type { Briefing, BriefingType } from "@/types/briefing"

import BriefingCard from "./BriefingCard"

type TabKey = "ALL" | BriefingType

const tabs: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DAILY_DIGEST", label: "Daily" },
  { key: "WEEKLY_SYNTHESIS", label: "Weekly" },
  { key: "TREND_ALERT", label: "Trends" },
  { key: "TEAM_REPORT", label: "Team" },
]

const LIMIT = 20

export default function BriefingFeed() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [generating, setGenerating] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchBriefings = useCallback(
    async (currentOffset: number, append = false) => {
      setLoading(true)
      try {
        const type = activeTab === "ALL" ? undefined : activeTab
        const result = await listBriefings({
          type,
          limit: LIMIT,
          offset: currentOffset,
        })
        setBriefings((prev) =>
          append ? [...prev, ...result.briefings] : result.briefings
        )
        setTotal(result.total)
      } catch {
        // silently handle
      } finally {
        setLoading(false)
      }
    },
    [activeTab]
  )

  useEffect(() => {
    setOffset(0)
    fetchBriefings(0)
  }, [fetchBriefings])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateNow()
      setOffset(0)
      await fetchBriefings(0)
    } catch {
      // silently handle
    } finally {
      setGenerating(false)
    }
  }

  const handleLoadMore = () => {
    const next = offset + LIMIT
    setOffset(next)
    fetchBriefings(next, true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-mono text-gray-600 uppercase tracking-wide">
          [INTELLIGENCE BRIEFINGS]
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Now"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
              activeTab === tab.key
                ? "bg-gray-900 text-white border-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && briefings.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-gray-200 p-4 space-y-3 animate-pulse"
            >
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-gray-200" />
                <div className="h-5 w-12 bg-gray-200" />
              </div>
              <div className="h-4 w-full bg-gray-200" />
              <div className="h-4 w-3/4 bg-gray-200" />
            </div>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 bg-white">
          <p className="text-sm font-mono text-gray-500">
            No briefings yet. Keep browsing and Cognia will generate your first
            daily digest.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <BriefingCard key={b.id} briefing={b} />
          ))}
          {briefings.length < total && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full py-2 text-xs font-mono text-gray-500 hover:text-gray-900 border border-gray-300 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
