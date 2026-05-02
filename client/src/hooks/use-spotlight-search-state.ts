import { useCallback, useEffect, useRef, useState } from "react"

import { useOrganization } from "../contexts/organization.context"
import { MemoryService } from "../services/memory.service"
import { SearchService } from "../services/search.service"
import type { MemorySearchResponse } from "../types/memory"
import { requireAuthToken } from "../utils/auth"

export function useSpotlightSearchState() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id ?? null
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false)
  const [spotlightSearchQuery, setSpotlightSearchQuery] = useState("")
  const [spotlightSearchResults, setSpotlightSearchResults] =
    useState<MemorySearchResponse | null>(null)
  const [spotlightSearchAnswer, setSpotlightSearchAnswer] = useState<
    string | null
  >(null)
  const [spotlightSearchCitations, setSpotlightSearchCitations] =
    useState<Array<{
      label: number
      memory_id: string
      title: string | null
      url: string | null
    }> | null>(null)
  const [spotlightSearchJobId, setSpotlightSearchJobId] = useState<
    string | null
  >(null)
  const [spotlightIsSearching, setSpotlightIsSearching] = useState(false)
  const [spotlightEmbeddingOnly, setSpotlightEmbeddingOnly] = useState(true)
  const spotlightAbortControllerRef = useRef<AbortController | null>(null)
  const spotlightDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSpotlightSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSpotlightSearchResults(null)
        setSpotlightSearchAnswer(null)
        setSpotlightSearchCitations(null)
        setSpotlightIsSearching(false)
        return
      }

      if (spotlightAbortControllerRef.current) {
        spotlightAbortControllerRef.current.abort()
      }

      spotlightAbortControllerRef.current = new AbortController()
      setSpotlightIsSearching(true)

      try {
        const signal = spotlightAbortControllerRef.current?.signal
        requireAuthToken()

        const response = await MemoryService.searchMemories(
          query,
          {},
          1,
          50,
          signal,
          undefined,
          spotlightEmbeddingOnly,
          orgId
        )

        if (signal?.aborted) return

        setSpotlightSearchResults(response)
        setSpotlightSearchAnswer(response.answer || null)
        setSpotlightSearchCitations(response.citations || null)

        if (response.job_id && !response.answer) {
          setSpotlightSearchJobId(response.job_id)
        } else {
          setSpotlightSearchJobId(null)
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
      } finally {
        if (!spotlightAbortControllerRef.current?.signal.aborted) {
          setSpotlightIsSearching(false)
        }
      }
    },
    [spotlightEmbeddingOnly, orgId]
  )

  useEffect(() => {
    if (spotlightDebounceTimeoutRef.current) {
      clearTimeout(spotlightDebounceTimeoutRef.current)
    }

    if (!spotlightSearchQuery.trim()) {
      setSpotlightSearchResults(null)
      setSpotlightSearchAnswer(null)
      setSpotlightSearchCitations(null)
      return
    }

    spotlightDebounceTimeoutRef.current = setTimeout(() => {
      if (spotlightSearchQuery.trim()) {
        handleSpotlightSearch(spotlightSearchQuery.trim())
      }
    }, 800)

    return () => {
      if (spotlightDebounceTimeoutRef.current) {
        clearTimeout(spotlightDebounceTimeoutRef.current)
      }
    }
  }, [spotlightSearchQuery, handleSpotlightSearch, spotlightEmbeddingOnly])

  useEffect(() => {
    if (!spotlightSearchJobId || spotlightSearchAnswer) return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const status = await SearchService.getJob(spotlightSearchJobId)
        if (cancelled) return
        if (status.status === "completed") {
          if (status.answer) setSpotlightSearchAnswer(status.answer)
          if (status.citations) setSpotlightSearchCitations(status.citations)
          clearInterval(interval)
          setSpotlightSearchJobId(null)
        } else if (status.status === "failed") {
          clearInterval(interval)
          setSpotlightSearchJobId(null)
        }
      } catch {
        // ignore polling errors
      }
    }, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [spotlightSearchJobId, spotlightSearchAnswer])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSpotlightOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (spotlightAbortControllerRef.current) {
        spotlightAbortControllerRef.current.abort()
      }
    }
  }, [])

  const resetSpotlight = useCallback(() => {
    setIsSpotlightOpen(false)
    setSpotlightSearchQuery("")
    setSpotlightSearchResults(null)
    setSpotlightSearchAnswer(null)
    setSpotlightSearchCitations(null)
  }, [])

  return {
    isSpotlightOpen,
    setIsSpotlightOpen,
    spotlightSearchQuery,
    setSpotlightSearchQuery,
    spotlightSearchResults,
    spotlightIsSearching,
    spotlightSearchAnswer,
    spotlightSearchCitations,
    spotlightEmbeddingOnly,
    setSpotlightEmbeddingOnly,
    resetSpotlight,
  }
}
