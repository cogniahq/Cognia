import React from "react"

interface BriefingsEmptyStateProps {
  onGenerateNow?: () => void
  generating?: boolean
}

/**
 * Empty state for the briefings feed. Replaces the previous "Keep browsing..."
 * dead-end with an actionable CTA: generate a briefing now, or capture more
 * memories to give Cognia something to work with.
 */
export const BriefingsEmptyState: React.FC<BriefingsEmptyStateProps> = ({
  onGenerateNow,
  generating,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-lg mx-auto border border-gray-200 bg-white">
      <div className="w-16 h-16 mb-6 flex items-center justify-center border border-gray-200 rounded-xl bg-white shadow-sm">
        <svg
          className="w-8 h-8 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-light font-editorial text-gray-900 mb-2">
        No briefings yet
      </h2>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        Briefings turn your captured memories into a daily digest, weekly
        synthesis, or trend alert. Generate one now, or keep browsing — Cognia
        will produce your first briefing automatically once it has enough
        material to work with.
      </p>
      {onGenerateNow && (
        <button
          onClick={onGenerateNow}
          disabled={generating}
          className="px-5 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate a briefing now"}
        </button>
      )}
      <a
        href="/integrations"
        className="text-xs font-mono text-gray-500 hover:text-gray-900 mt-6"
      >
        Or connect an integration to seed more sources →
      </a>
    </div>
  )
}

export default BriefingsEmptyState
