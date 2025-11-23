import React from "react"

interface Citation {
  label: number
  memory_id: string
  title: string | null
  url: string | null
}

interface SpotlightSearchCitationsProps {
  uniqueCitations: Citation[]
  isSearching: boolean
}

export const SpotlightSearchCitations: React.FC<
  SpotlightSearchCitationsProps
> = ({ uniqueCitations, isSearching }) => {
  if (isSearching || uniqueCitations.length === 0) {
    return null
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
        Citations
      </div>
      <div className="space-y-1">
        {uniqueCitations.map((citation) => {
          const title = citation.title || "Untitled Memory"
          const url =
            citation.url && citation.url !== "unknown" ? citation.url : null
          return (
            <div
              key={`${citation.memory_id}-${citation.label}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-gray-500">[{citation.label}]</span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-black hover:underline truncate"
                >
                  {title}
                </a>
              ) : (
                <span className="text-gray-700 truncate">{title}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

