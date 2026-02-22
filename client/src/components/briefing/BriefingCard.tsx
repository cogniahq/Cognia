import { useEffect, useRef } from "react"
import { markAsRead } from "@/services/briefing/briefing.service"

import type { Briefing, BriefingType } from "@/types/briefing"

interface BriefingCardProps {
  briefing: Briefing
  onMarkRead?: () => void
}

const typeConfig: Record<
  BriefingType,
  { label: string; bg: string; text: string }
> = {
  DAILY_DIGEST: {
    label: "Daily",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  WEEKLY_SYNTHESIS: {
    label: "Weekly",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  TREND_ALERT: {
    label: "Trend",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  TEAM_REPORT: {
    label: "Team",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
}

const trendIcon: Record<string, string> = {
  rising: "\u2191",
  stable: "\u2192",
  new: "\u2726",
  declining: "\u2193",
}

function relativeDate(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function BriefingCard({
  briefing,
  onMarkRead,
}: BriefingCardProps) {
  const markedRef = useRef(false)

  useEffect(() => {
    if (briefing.read_at || markedRef.current) return
    markedRef.current = true
    markAsRead(briefing.id).then(() => onMarkRead?.())
  }, [briefing.id, briefing.read_at, onMarkRead])

  const config = typeConfig[briefing.briefing_type]

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
        >
          {config.label}
        </span>
        <span className="text-gray-400 text-xs">
          {relativeDate(briefing.created_at)}
        </span>
        {!briefing.read_at && (
          <span className="ml-auto h-2 w-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {briefing.summary}
      </p>

      {/* Topics */}
      {briefing.topics.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Topics
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {briefing.topics.map((t) => (
              <span
                key={t.topic}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300"
              >
                {t.topic} {trendIcon[t.trend]} ({t.memoryCount})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wow Facts */}
      {briefing.wow_facts && briefing.wow_facts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Interesting Findings
          </h4>
          <div className="space-y-1.5">
            {briefing.wow_facts.map((fact, i) => (
              <div
                key={i}
                className="bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400 pl-3 py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {fact}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Gaps */}
      {briefing.knowledge_gaps && briefing.knowledge_gaps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Explore Next
          </h4>
          <div className="space-y-1.5">
            {briefing.knowledge_gaps.map((gap, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {gap.topic}
                </span>{" "}
                <span className="text-gray-700 dark:text-gray-300">
                  {gap.suggestion}
                </span>
                <span className="text-gray-400 text-xs ml-1">{gap.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {briefing.connections && briefing.connections.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Connections Discovered
          </h4>
          <div className="space-y-1">
            {briefing.connections.map((c, i) => (
              <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{c.memoryA}</span>
                {" \u2194 "}
                <span className="font-medium">{c.memoryB}</span>
                {": "}
                {c.insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expert Updates */}
      {briefing.expert_updates && briefing.expert_updates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Team Activity
          </h4>
          <div className="space-y-1.5">
            {briefing.expert_updates.map((expert) => (
              <div
                key={expert.userId}
                className="flex items-center gap-2 text-sm"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {expert.name}
                </span>
                <div className="flex gap-1">
                  {expert.topics.map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-gray-400 text-xs ml-auto">
                  {expert.newMemories} new memories
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
