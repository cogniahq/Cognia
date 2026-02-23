import { useEffect, useRef } from "react"
import { markAsRead } from "@/services/briefing/briefing.service"

import type { Briefing, BriefingType } from "@/types/briefing"

interface BriefingCardProps {
  briefing: Briefing
  onMarkRead?: () => void
}

const typeLabels: Record<BriefingType, string> = {
  DAILY_DIGEST: "DAILY",
  WEEKLY_SYNTHESIS: "WEEKLY",
  TREND_ALERT: "TREND",
  TEAM_REPORT: "TEAM",
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

  return (
    <div className="bg-white border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700">
          {typeLabels[briefing.briefing_type]}
        </span>
        <span className="text-xs font-mono text-gray-500">
          {relativeDate(briefing.created_at)}
        </span>
        {!briefing.read_at && (
          <span className="ml-auto h-1.5 w-1.5 bg-gray-900" />
        )}
      </div>

      {/* Summary */}
      <p className="text-sm font-mono text-gray-900">{briefing.summary}</p>

      {/* Topics */}
      {briefing.topics.length > 0 && (
        <div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            [TOPICS]
          </div>
          <div className="flex flex-wrap gap-1.5">
            {briefing.topics.map((t) => (
              <span
                key={t.topic}
                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
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
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            [INSIGHTS]
          </div>
          <div className="space-y-1.5">
            {briefing.wow_facts.map((fact, i) => (
              <div
                key={i}
                className="border-l-2 border-gray-300 pl-3 py-1 text-sm font-mono text-gray-700"
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
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            [EXPLORE NEXT]
          </div>
          <div className="space-y-2">
            {briefing.knowledge_gaps.map((gap, i) => (
              <div key={i} className="text-sm font-mono">
                <span className="text-gray-900">{gap.topic}</span>
                <span className="text-gray-600"> — {gap.suggestion}</span>
                <span className="text-xs text-gray-400 ml-1">
                  ({gap.reason})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {briefing.connections && briefing.connections.length > 0 && (
        <div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            [CONNECTIONS]
          </div>
          <div className="space-y-1.5">
            {briefing.connections.map((c, i) => (
              <div key={i} className="text-sm font-mono text-gray-700">
                <span className="text-gray-900">{c.memoryA}</span>
                {" \u2194 "}
                <span className="text-gray-900">{c.memoryB}</span>
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
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            [TEAM ACTIVITY]
          </div>
          <div className="space-y-2">
            {briefing.expert_updates.map((expert) => (
              <div
                key={expert.userId}
                className="flex items-center gap-2 text-sm font-mono"
              >
                <span className="text-gray-900">{expert.name}</span>
                <div className="flex gap-1">
                  {expert.topics.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-400 ml-auto">
                  {expert.newMemories} new
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
