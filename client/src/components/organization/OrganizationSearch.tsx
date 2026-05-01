import { useCallback, useEffect, useState } from "react"
import { useOrganization } from "@/contexts/organization.context"
import * as organizationService from "@/services/organization/organization.service"
import type { DocumentPreviewData } from "@/services/organization/organization.service"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"

import type { OrganizationSearchResponse } from "@/types/organization"
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal"
import { getOrganizationAnswerDeliveryMode } from "@/components/organization/organization-answer-delivery"
import { getOrganizationAnswerState } from "@/components/organization/organization-answer-state"
import { getVisibleOrganizationSearchCitations } from "@/components/organization/organization-search-citations"
import {
  getOrganizationSearchFilterLabel,
  getOrganizationSearchFilters,
  getOrganizationSearchSourceTypes,
} from "@/components/organization/organization-search-filters"
import { getOrganizationSearchSectionOrder } from "@/components/organization/organization-search-layout"
import { getOrganizationSearchLoadingState } from "@/components/organization/organization-search-loading"
import { buildOrganizationSearchOpenUrl } from "@/components/organization/organization-search-opening"
import { getVisibleOrganizationSearchResults } from "@/components/organization/organization-search-results"
import { getOrganizationSearchState } from "@/components/organization/organization-search-state"
import { OrganizationSummaryMarkdown } from "@/components/organization/OrganizationSummaryMarkdown"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants"

function mapAnswerJobCitations(
  citations: organizationService.AnswerJobResult["citations"]
): OrganizationSearchResponse["citations"] {
  return citations?.map((citation) => ({
    index: citation.label,
    documentName: citation.title || undefined,
    memoryId: citation.memory_id,
    url: citation.url || undefined,
    sourceType: citation.source_type || undefined,
    authorEmail: citation.author_email || undefined,
    capturedAt: citation.captured_at || undefined,
  }))
}

export function OrganizationSearch() {
  const { currentOrganization, documents } = useOrganization()
  const [query, setQuery] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [activeFilterId, setActiveFilterId] = useState("ALL")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<OrganizationSearchResponse | null>(
    null
  )
  const [error, setError] = useState("")
  const [summaryError, setSummaryError] = useState("")
  const [summaryLoadingPhase, setSummaryLoadingPhase] = useState(0)

  // Document preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<DocumentPreviewData | null>(
    null
  )
  const searchFilters = getOrganizationSearchFilters()
  const activeFilterLabel = getOrganizationSearchFilterLabel(activeFilterId)

  const runSearch = useCallback(
    async (trimmedQuery: string, filterId: string) => {
      if (!currentOrganization) return

      setIsSearching(true)
      setError("")
      setSummaryError("")
      setSummaryLoadingPhase(0)
      setResults(null)

      try {
        const searchResults = await organizationService.searchOrganization(
          currentOrganization.slug,
          trimmedQuery,
          {
            includeAnswer: true,
            sourceTypes: getOrganizationSearchSourceTypes(filterId),
          }
        )
        setResults(searchResults)
        setSubmittedQuery(trimmedQuery)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        setIsSearching(false)
      }
    },
    [currentOrganization]
  )

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!query.trim() || !currentOrganization) return
      const trimmedQuery = query.trim()
      await runSearch(trimmedQuery, activeFilterId)
    },
    [activeFilterId, currentOrganization, query, runSearch]
  )

  const handleFilterChange = useCallback(
    (nextFilterId: string) => {
      if (nextFilterId === activeFilterId) {
        return
      }

      setActiveFilterId(nextFilterId)

      const rerunQuery = submittedQuery || query.trim()
      if (!rerunQuery || !currentOrganization) {
        return
      }

      void runSearch(rerunQuery, nextFilterId)
    },
    [activeFilterId, currentOrganization, query, runSearch, submittedQuery]
  )

  const searchState = getOrganizationSearchState({
    documentCount: documents.length,
  })

  // Handle clicking on a citation to preview the document or open URL
  const handleCitationClick = useCallback(
    async (memoryId: string, url?: string, sourceType?: string) => {
      const matchedResult = results?.results.find(
        (result) => result.memoryId === memoryId
      )

      // For extension/integration sources with a URL, open directly
      if (url && (sourceType === "EXTENSION" || sourceType === "INTEGRATION")) {
        const openUrl = buildOrganizationSearchOpenUrl({
          url,
          query: submittedQuery || query,
          result: matchedResult,
        })
        window.open(openUrl || url, "_blank", "noopener,noreferrer")
        return
      }

      if (!currentOrganization) return

      setPreviewOpen(true)
      setPreviewLoading(true)
      setPreviewError(null)
      setPreviewData(null)

      try {
        const data = await organizationService.getDocumentByMemory(
          currentOrganization.slug,
          memoryId
        )
        setPreviewData(data)
      } catch (err) {
        // If document not found but we have a URL, try opening it
        if (url) {
          const openUrl = buildOrganizationSearchOpenUrl({
            url,
            query: submittedQuery || query,
            result: matchedResult,
          })
          window.open(openUrl || url, "_blank", "noopener,noreferrer")
          setPreviewOpen(false)
          return
        }
        setPreviewError(
          err instanceof Error ? err.message : "Failed to load document"
        )
      } finally {
        setPreviewLoading(false)
      }
    },
    [currentOrganization, query, results?.results, submittedQuery]
  )

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    setPreviewData(null)
    setPreviewError(null)
  }, [])

  const visibleResults = getVisibleOrganizationSearchResults({
    results: results?.results,
    citations: results?.citations,
    answerJobId: results?.answerJobId,
  })
  const visibleCitations = getVisibleOrganizationSearchCitations(
    results?.citations
  )
  const summaryLoadingState = getOrganizationSearchLoadingState({
    query: submittedQuery || query.trim(),
    filterLabel: activeFilterLabel,
    phaseIndex: summaryLoadingPhase,
    results: results?.results,
  })
  const hasFetchedResults = Boolean(results?.results?.length)
  const answerState = getOrganizationAnswerState({
    answerJobId: results?.answerJobId,
    answer: results?.answer,
  })
  const answerDelivery = getOrganizationAnswerDeliveryMode()
  const hasSummarySection =
    hasFetchedResults &&
    (answerState.shouldPoll ||
      Boolean(answerState.renderableAnswer) ||
      Boolean(summaryError))
  const sectionOrder = getOrganizationSearchSectionOrder({
    hasSummary: hasSummarySection,
    hasResults: visibleResults.length > 0,
  })

  useEffect(() => {
    const jobId = results?.answerJobId

    if (!jobId || !answerState.shouldPoll) {
      return
    }

    let isCancelled = false
    let timeoutId: number | undefined

    const stopPolling = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }

    const updateCompletedAnswer = (
      job: organizationService.AnswerJobResult
    ) => {
      setSummaryError("")
      setResults((currentResults) => {
        if (!currentResults || currentResults.answerJobId !== jobId) {
          return currentResults
        }

        return {
          ...currentResults,
          answer: job.answer,
          citations: mapAnswerJobCitations(job.citations),
          answerJobId: undefined,
        }
      })
    }

    const markSummaryUnavailable = (message: string) => {
      setSummaryError(message)
      setResults((currentResults) => {
        if (!currentResults || currentResults.answerJobId !== jobId) {
          return currentResults
        }

        return {
          ...currentResults,
          answerJobId: undefined,
        }
      })
    }

    if (!answerDelivery.shouldPoll) {
      const unsubscribe = organizationService.subscribeToAnswerJob(jobId, {
        onCompleted: (job) => {
          if (isCancelled) {
            return
          }
          updateCompletedAnswer(job)
        },
        onError: (message) => {
          if (isCancelled) {
            return
          }
          markSummaryUnavailable(message || "Summary generation failed.")
        },
      })

      return () => {
        isCancelled = true
        unsubscribe()
      }
    }

    const pollAnswerJob = async () => {
      try {
        const job = await organizationService.getAnswerJobStatus(jobId)

        if (isCancelled) {
          return
        }

        if (job.status === "completed") {
          updateCompletedAnswer(job)
          return
        }

        if (job.status === "failed") {
          markSummaryUnavailable("Summary generation failed.")
          return
        }

        timeoutId = window.setTimeout(pollAnswerJob, 1500)
      } catch (err) {
        if (isCancelled) {
          return
        }

        markSummaryUnavailable(
          err instanceof Error ? err.message : "Summary generation failed."
        )
      }
    }

    pollAnswerJob()

    return () => {
      isCancelled = true
      stopPolling()
    }
  }, [answerDelivery.shouldPoll, answerState.shouldPoll, results?.answerJobId])

  useEffect(() => {
    if (!answerState.shouldPoll) {
      setSummaryLoadingPhase(0)
      return
    }

    const maxPhaseIndex = Math.max(0, summaryLoadingState.steps.length - 1)

    const intervalId = window.setInterval(() => {
      setSummaryLoadingPhase((currentPhase) =>
        currentPhase >= maxPhaseIndex ? currentPhase : currentPhase + 1
      )
    }, 1400)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [answerState.shouldPoll, summaryLoadingState.steps.length])

  return (
    <div className="space-y-6">
      {/* Search form */}
      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeUpVariants}
        className="space-y-3"
      >
        <LayoutGroup id="organization-search-filters">
          <motion.div
            className="flex flex-wrap gap-2"
            initial="initial"
            animate="animate"
            variants={staggerContainerVariants}
          >
            {searchFilters.map((filter) => {
              const isActive = activeFilterId === filter.id

              return (
                <motion.button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterChange(filter.id)}
                  className={`relative overflow-hidden rounded-full border px-3 py-1.5 text-xs font-mono transition-colors ${
                    isActive
                      ? "border-gray-900 text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900"
                  }`}
                  variants={fadeUpVariants}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="organization-search-filter-pill"
                      className="absolute inset-0 bg-gray-900"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10">{filter.label}</span>
                </motion.button>
              )
            })}
          </motion.div>
        </LayoutGroup>

        <motion.form onSubmit={handleSearch} layout className="space-y-2">
          <div className="flex gap-2">
            <motion.input
              type="text"
              placeholder={searchState.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={searchState.isDisabled}
              className="flex-1 px-4 py-3 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
              whileFocus={{ scale: 1.003 }}
            />
            <motion.button
              type="submit"
              disabled={isSearching || !query.trim() || searchState.isDisabled}
              className="px-6 py-3 text-sm font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSearching ? "Searching..." : "Search"}
            </motion.button>
          </div>
        </motion.form>

        <motion.div
          className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-gray-500"
          layout
        >
          <span>[FILTER] {activeFilterLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            {submittedQuery && <span>Applied to "{submittedQuery}"</span>}
          </div>
        </motion.div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          Error: {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {sectionOrder.map((section) => {
            if (section !== "summary") return null

            return (
              <motion.div
                key="summary"
                initial="initial"
                animate="animate"
                variants={fadeUpVariants}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                    [SUMMARY]
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {answerState.shouldPoll
                      ? "Synthesizing..."
                      : answerState.renderableAnswer
                        ? "Ready"
                        : "Unavailable"}
                  </span>
                </div>

                <div
                  className={
                    answerState.shouldPoll
                      ? ""
                      : "border border-gray-200 bg-white p-4"
                  }
                >
                  {answerState.renderableAnswer ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <OrganizationSummaryMarkdown
                          markdown={answerState.renderableAnswer}
                        />
                      </motion.div>

                      {visibleCitations.length > 0 && (
                        <motion.div
                          className="mt-4 flex flex-wrap gap-2"
                          initial="initial"
                          animate="animate"
                          variants={staggerContainerVariants}
                        >
                          {visibleCitations.map((citation) => (
                            <motion.button
                              key={`${citation.memoryId}-${citation.indices.join("-")}`}
                              onClick={() =>
                                handleCitationClick(
                                  citation.memoryId,
                                  citation.url,
                                  citation.sourceType
                                )
                              }
                              className="flex flex-col items-start rounded border border-gray-200 px-2 py-1 text-left text-xs font-mono text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
                              variants={fadeUpVariants}
                              whileHover={{ y: -2, scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <span>
                                [{citation.indices.join(", ")}]{" "}
                                {citation.documentName || "Source"}
                              </span>
                              {citation.authorEmail && (
                                <span className="mt-0.5 truncate text-[10px] font-mono text-gray-500">
                                  captured by{" "}
                                  {citation.authorEmail.split("@")[0]}
                                  {citation.capturedAt && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      {new Date(
                                        citation.capturedAt
                                      ).toLocaleDateString()}
                                    </>
                                  )}
                                </span>
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </>
                  ) : answerState.shouldPoll ? (
                    <div className="relative overflow-hidden border border-gray-200 bg-gradient-to-br from-white via-stone-50 to-gray-50 p-4 sm:p-5">
                      <motion.div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-900 to-transparent"
                        animate={{
                          opacity: [0.2, 0.75, 0.2],
                          scaleX: [0.75, 1, 0.75],
                        }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />

                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-gray-500">
                            <span>Summary Pipeline</span>
                            {summaryLoadingState.queryLabel && (
                              <span className="rounded-full border border-gray-200 bg-white px-2 py-1 normal-case tracking-normal text-gray-600">
                                {summaryLoadingState.queryLabel}
                              </span>
                            )}
                          </div>

                          <AnimatePresence mode="wait">
                            <motion.div
                              key={`${summaryLoadingState.activeStepIndex}-${summaryLoadingState.activeStep.label}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.24 }}
                              className="mt-3"
                            >
                              <p className="text-lg font-medium text-gray-900">
                                {summaryLoadingState.activeStep.label}
                              </p>
                              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
                                {summaryLoadingState.activeStep.description}
                              </p>
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        <motion.div
                          className="flex min-w-[88px] flex-col items-end gap-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xs font-mono text-gray-400">
                            {summaryLoadingState.progressLabel}
                          </span>
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                            <motion.div
                              className="h-full rounded-full bg-gray-900"
                              animate={{
                                width: `${summaryLoadingState.progressValue * 100}%`,
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 220,
                                damping: 24,
                              }}
                            />
                          </div>
                        </motion.div>
                      </div>

                      <motion.div
                        className="mt-5 grid gap-3 sm:grid-cols-3"
                        initial="initial"
                        animate="animate"
                        variants={staggerContainerVariants}
                      >
                        {summaryLoadingState.metrics.map((metric) => (
                          <motion.div
                            key={metric.label}
                            className="rounded-xl border border-gray-200 bg-white/90 px-3 py-3"
                            variants={fadeUpVariants}
                          >
                            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-400">
                              {metric.label}
                            </div>
                            <div className="mt-1 text-sm font-medium text-gray-800">
                              {metric.value}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>

                      {summaryLoadingState.sourceLabels.length > 0 && (
                        <div className="mt-5">
                          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-400">
                            Active Evidence
                          </div>
                          <motion.div
                            className="mt-2 flex flex-wrap gap-2"
                            initial="initial"
                            animate="animate"
                            variants={staggerContainerVariants}
                          >
                            {summaryLoadingState.sourceLabels.map((label) => (
                              <motion.span
                                key={label}
                                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-mono text-gray-600"
                                variants={fadeUpVariants}
                                animate={{
                                  y: [0, -2, 0],
                                }}
                                transition={{
                                  duration: 2.2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                {label}
                              </motion.span>
                            ))}
                            {summaryLoadingState.remainingSourceCount > 0 && (
                              <motion.span
                                className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-mono text-gray-500"
                                variants={fadeUpVariants}
                              >
                                +{summaryLoadingState.remainingSourceCount} more
                              </motion.span>
                            )}
                          </motion.div>
                        </div>
                      )}

                      <div className="mt-5 space-y-2">
                        {summaryLoadingState.steps.map((step) => (
                          <div
                            key={step.label}
                            className="flex items-center gap-3 text-sm text-gray-500"
                          >
                            <motion.span
                              className={`h-2.5 w-2.5 rounded-full ${
                                step.isActive
                                  ? "bg-gray-900"
                                  : step.isComplete
                                    ? "bg-gray-500"
                                    : "bg-gray-300"
                              }`}
                              animate={
                                step.isActive
                                  ? {
                                      scale: [1, 1.35, 1],
                                      opacity: [0.7, 1, 0.7],
                                    }
                                  : { scale: 1, opacity: 1 }
                              }
                              transition={{
                                duration: 1.2,
                                repeat: step.isActive ? Infinity : 0,
                                ease: "easeInOut",
                              }}
                            />
                            <span className="font-medium text-gray-700">
                              {step.label}
                            </span>
                            <span className="hidden text-gray-400 sm:inline">
                              {step.description}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-2">
                        {summaryLoadingState.skeletonWidths.map(
                          (width, index) => (
                            <motion.div
                              key={width}
                              className="h-2 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                              animate={{
                                opacity: [0.45, 0.95, 0.45],
                                x: [0, 6, 0],
                              }}
                              transition={{
                                duration: 1.4,
                                delay: index * 0.12,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                              style={{ width }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {summaryError || "Summary unavailable."}
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}

          {visibleResults.length > 0 && (
            <motion.div
              initial="initial"
              animate="animate"
              variants={fadeUpVariants}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                  [RESULTS]
                </span>
                <span className="text-xs font-mono text-gray-400">
                  {visibleResults.length} source
                  {visibleResults.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-3">
                {visibleResults.map((result) => {
                  const tags = Array.isArray(result.metadata?.tags)
                    ? (result.metadata?.tags as string[]).filter(
                        (tag) => typeof tag === "string"
                      )
                    : []

                  return (
                    <div
                      key={result.memoryId}
                      className="border border-gray-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono uppercase tracking-wide text-gray-400">
                              [{result.sourceType}]
                            </span>
                            <h3 className="truncate text-sm font-medium text-gray-900">
                              {result.documentName || result.title || "Source"}
                            </h3>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
                            {result.pageNumber && (
                              <span>Page {result.pageNumber}</span>
                            )}
                            <span>Score {result.score.toFixed(3)}</span>
                          </div>

                          {tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {tags.map((tag) => (
                                <span
                                  key={`${result.memoryId}-${tag}`}
                                  className="border border-gray-200 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-gray-500"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="mt-3 text-sm leading-relaxed text-gray-600">
                            {result.highlightText || result.contentPreview}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleCitationClick(
                              result.memoryId,
                              result.url,
                              result.sourceType
                            )
                          }
                          className="border border-gray-300 px-3 py-2 text-xs font-mono text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900"
                        >
                          Open Source
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {results.results.length === 0 && (
            <div className="border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
              No matching documents or browsing memories were found for this
              search.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !isSearching && !error && (
        <div className="text-center py-12">
          <>
            <div className="text-sm font-mono text-gray-600 mb-2">
              {documents.length > 0
                ? "Search Your Documents and Memories"
                : "Search Your Browsing Memories"}
            </div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
              Ask questions in natural language and review the fetched document
              content directly.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "What are the key findings?",
                "Show the fetched passages about this topic",
                "Find all mentions of...",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="px-3 py-1.5 text-xs font-mono text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={closePreview}
        documentData={previewData}
        isLoading={previewLoading}
        error={previewError}
        highlightQuery={submittedQuery}
      />
    </div>
  )
}
