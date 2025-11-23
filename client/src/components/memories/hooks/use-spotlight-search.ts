import { useCallback, useEffect, useMemo, useState } from "react"
import type { MemorySearchResponse } from "../../../types/memory"

interface Citation {
  label: number
  memory_id: string
  title: string | null
  url: string | null
}

export function useSpotlightSearch(
  searchResults: MemorySearchResponse | null,
  selectedIndex: number,
  setSelectedIndex: (index: number) => void,
  isEmbeddingOnly: boolean
) {
  const getDeduplicatedCitations = useCallback(
    (searchCitations: Citation[] | null) => {
      if (!searchCitations || searchCitations.length === 0) {
        return { uniqueCitations: [], labelMap: new Map<number, number>() }
      }

      const urlToFirstLabel = new Map<string, number>()
      const memoryIdToFirstLabel = new Map<string, number>()
      const uniqueCitations: Citation[] = []
      const labelMap = new Map<number, number>()

      searchCitations.forEach((citation) => {
        const url =
          citation.url && citation.url !== "unknown" ? citation.url : null
        const originalLabel = citation.label ?? 0

        if (url) {
          const firstLabel = urlToFirstLabel.get(url)
          if (firstLabel !== undefined) {
            labelMap.set(originalLabel, firstLabel)
          } else {
            const newLabel = uniqueCitations.length + 1
            urlToFirstLabel.set(url, newLabel)
            uniqueCitations.push({ ...citation, label: newLabel })
            labelMap.set(originalLabel, newLabel)
          }
        } else {
          const firstLabel = memoryIdToFirstLabel.get(citation.memory_id)
          if (firstLabel !== undefined) {
            labelMap.set(originalLabel, firstLabel)
          } else {
            const newLabel = uniqueCitations.length + 1
            memoryIdToFirstLabel.set(citation.memory_id, newLabel)
            uniqueCitations.push({ ...citation, label: newLabel })
            labelMap.set(originalLabel, newLabel)
          }
        }
      })

      return { uniqueCitations, labelMap }
    },
    []
  )

  const processAnswerText = useCallback(
    (text: string, labelMap: Map<number, number>): string => {
      if (!text || labelMap.size === 0) return text

      let processed = text.replace(
        /\[(\d+(?:\s*,\s*\d+)*)\]/g,
        (_match, numbers) => {
          const citationNumbers = numbers
            .split(",")
            .map((n: string) => parseInt(n.trim(), 10))
            .filter((n: number) => !isNaN(n))

          const mappedNumbers = citationNumbers
            .map((n: number) => labelMap.get(n))
            .filter((n: number | undefined): n is number => n !== undefined)
            .sort((a: number, b: number) => a - b)

          const uniqueMappedNumbers = Array.from(new Set(mappedNumbers))

          if (uniqueMappedNumbers.length === 0) {
            return ""
          }

          return `[${uniqueMappedNumbers.join(", ")}]`
        }
      )

      processed = processed.replace(
        /(\[\d+(?:,\s*\d+)*\])(?:\s*,\s*\1|\s+\1)+/g,
        "$1"
      )

      processed = processed
        .replace(/[ \t]+/g, " ")
        .replace(/^[ \t]+|[ \t]+$/gm, "")

      return processed
    },
    []
  )

  return {
    getDeduplicatedCitations,
    processAnswerText,
  }
}

