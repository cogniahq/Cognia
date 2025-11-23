import React, { memo, useCallback, useEffect, useState } from "react"

import type { Memory, MemorySearchResponse } from "../../types/memory"
import { SpotlightSearchAnswer } from "./SpotlightSearchAnswer"
import { SpotlightSearchCitations } from "./SpotlightSearchCitations"
import { SpotlightSearchInput } from "./SpotlightSearchInput"
import { SpotlightSearchResults } from "./SpotlightSearchResults"
import { useSpotlightSearch } from "./hooks/use-spotlight-search"

interface SpotlightSearchProps {
  isOpen: boolean
  searchQuery: string
  searchResults: MemorySearchResponse | null
  isSearching: boolean
  searchAnswer: string | null
  searchCitations: Array<{
    label: number
    memory_id: string
    title: string | null
    url: string | null
  }> | null
  isEmbeddingOnly: boolean
  onEmbeddingOnlyChange: (value: boolean) => void
  onSearchQueryChange: (query: string) => void
  onSelectMemory: (memory: Memory) => void
  onClose: () => void
}

const SpotlightSearchComponent: React.FC<SpotlightSearchProps> = ({
  isOpen,
  searchQuery,
  searchResults,
  isSearching,
  searchAnswer,
  searchCitations,
  isEmbeddingOnly,
  onEmbeddingOnlyChange,
  onSearchQueryChange,
  onSelectMemory,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const { getDeduplicatedCitations, processAnswerText } = useSpotlightSearch(
    searchResults,
    selectedIndex,
    setSelectedIndex,
    isEmbeddingOnly
  )

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(-1)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [isEmbeddingOnly])

  useEffect(() => {
    if (!isOpen) return

    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener("keydown", handleGlobalEscape, true)
    return () => {
      document.removeEventListener("keydown", handleGlobalEscape, true)
    }
  }, [isOpen, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }

      if (!isEmbeddingOnly) return

      const results = searchResults?.results || []

      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (results.length > 0) {
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        }
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (results.length > 0) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        }
        return
      }

      if (e.key === "Enter" && selectedIndex >= 0) {
        if (results[selectedIndex]) {
          const memory = results[selectedIndex].memory
          if (memory.url) {
            window.open(memory.url, "_blank", "noopener,noreferrer")
          } else {
            onSelectMemory(memory)
            onClose()
          }
        }
        return
      }
    },
    [searchResults, selectedIndex, onSelectMemory, onClose, isEmbeddingOnly]
  )

  useEffect(() => {
    if (selectedIndex >= 0) {
      const element = document.getElementById(`search-result-${selectedIndex}`)
      if (element) {
        element.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  const { uniqueCitations, labelMap } = getDeduplicatedCitations(
    searchCitations
  )
  const processedAnswer = searchAnswer
    ? processAnswerText(searchAnswer, labelMap)
    : null

  const handleSelectMemory = useCallback(
    (memoryId: string, url: string | null) => {
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        const results = searchResults?.results || []
        const result = results.find((r) => r.memory.id === memoryId)
        if (result) {
          onSelectMemory(result.memory)
          onClose()
        }
      }
    },
    [searchResults, onSelectMemory, onClose]
  )

  const showNoResults =
    !isEmbeddingOnly &&
    !isSearching &&
    searchQuery.trim() &&
    searchResults !== null &&
    !processedAnswer &&
    uniqueCitations.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-gray-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SpotlightSearchInput
          searchQuery={searchQuery}
          isEmbeddingOnly={isEmbeddingOnly}
          onSearchQueryChange={onSearchQueryChange}
          onEmbeddingOnlyChange={onEmbeddingOnlyChange}
          onClose={onClose}
          onKeyDown={handleKeyDown}
          isOpen={isOpen}
        />

        <div className="max-h-[60vh] overflow-y-auto">
          <SpotlightSearchResults
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            isEmbeddingOnly={isEmbeddingOnly}
            selectedIndex={selectedIndex}
            onSelectMemory={handleSelectMemory}
          />

          {showNoResults && (
            <div className="p-8 text-center text-sm text-gray-500">
              No memories found for "{searchQuery}"
            </div>
          )}

          <SpotlightSearchAnswer
            processedAnswer={processedAnswer}
            isSearching={isSearching}
          />

          <SpotlightSearchCitations
            uniqueCitations={uniqueCitations}
            isSearching={isSearching}
          />
        </div>
      </div>
    </div>
  )
}

export const SpotlightSearch = memo(SpotlightSearchComponent)
SpotlightSearch.displayName = "SpotlightSearch"
