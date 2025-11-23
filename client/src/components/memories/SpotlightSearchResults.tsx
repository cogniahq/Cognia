import React from "react"
import type { MemorySearchResponse } from "../../types/memory"

interface SpotlightSearchResultsProps {
  searchQuery: string
  searchResults: MemorySearchResponse | null
  isSearching: boolean
  isEmbeddingOnly: boolean
  selectedIndex: number
  onSelectMemory: (memoryId: string, url: string | null) => void
}

export const SpotlightSearchResults: React.FC<SpotlightSearchResultsProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  isEmbeddingOnly,
  selectedIndex,
  onSelectMemory,
}) => {
  const results = searchResults?.results || []

  if (!searchQuery.trim()) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        Start typing to search your memories...
      </div>
    )
  }

  if (isSearching) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
          <span>Searching memories...</span>
        </div>
      </div>
    )
  }

  if (
    isEmbeddingOnly &&
    searchResults !== null &&
    results.length === 0
  ) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        No memories found for "{searchQuery}"
      </div>
    )
  }

  if (isEmbeddingOnly && results.length > 0) {
    return (
      <div className="divide-y divide-gray-100">
        {results.map((result, idx) => {
          const memory = result.memory
          const isSelected = idx === selectedIndex
          return (
            <div
              key={memory.id}
              id={`search-result-${idx}`}
              className={`p-4 cursor-pointer transition-colors ${
                isSelected ? "bg-gray-50" : "hover:bg-gray-50"
              }`}
              onClick={() => {
                onSelectMemory(memory.id, memory.url || null)
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {memory.title || "Untitled Memory"}
                    </h3>
                    {result.blended_score !== undefined && (
                      <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                        {(result.blended_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    {memory.created_at
                      ? new Date(memory.created_at).toLocaleDateString()
                      : "NO DATE"}{" "}
                    • {memory.source || "UNKNOWN"}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return null
}

