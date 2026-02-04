import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useOrganization } from "@/contexts/organization.context"
import * as organizationService from "@/services/organization/organization.service"
import type { OrganizationSearchResponse } from "@/types/organization"
import type { DocumentPreviewData, AnswerJobResult } from "@/services/organization/organization.service"
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal"

export function OrganizationSearch() {
  const { currentOrganization, documents } = useOrganization()
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<OrganizationSearchResponse | null>(null)
  const [error, setError] = useState("")

  // Answer streaming state
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false)
  const [answerData, setAnswerData] = useState<AnswerJobResult | null>(null)
  const [answerElapsed, setAnswerElapsed] = useState(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Document preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<DocumentPreviewData | null>(null)

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  // Subscribe to answer job via SSE
  const subscribeToAnswer = useCallback((jobId: string) => {
    setIsLoadingAnswer(true)
    setAnswerData(null)
    setAnswerElapsed(0)

    // Clean up any existing subscription
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    cleanupRef.current = organizationService.subscribeToAnswerJob(jobId, {
      onCompleted: (result) => {
        setAnswerData(result)
        setIsLoadingAnswer(false)
        cleanupRef.current = null
      },
      onError: (errorMsg) => {
        console.error("Answer generation error:", errorMsg)
        setIsLoadingAnswer(false)
        cleanupRef.current = null
      },
      onHeartbeat: (elapsed) => {
        setAnswerElapsed(elapsed)
      },
    })
  }, [])

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!query.trim() || !currentOrganization) return

      setIsSearching(true)
      setError("")
      setResults(null)
      setAnswerData(null)
      setIsLoadingAnswer(false)
      setAnswerElapsed(0)

      // Clean up any existing subscription
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }

      try {
        const searchResults = await organizationService.searchOrganization(
          currentOrganization.slug,
          query.trim(),
          { limit: 20, includeAnswer: true }
        )
        setResults(searchResults)

        // If there's a job ID, subscribe to SSE for the answer
        if (searchResults.answerJobId) {
          subscribeToAnswer(searchResults.answerJobId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        setIsSearching(false)
      }
    },
    [query, currentOrganization, subscribeToAnswer]
  )

  const hasDocuments = documents.length > 0

  // Handle clicking on a citation to preview the document
  const handleCitationClick = useCallback(
    async (memoryId: string) => {
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
        setPreviewError(err instanceof Error ? err.message : "Failed to load document")
      } finally {
        setPreviewLoading(false)
      }
    },
    [currentOrganization]
  )

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    setPreviewData(null)
    setPreviewError(null)
  }, [])

  // Get the current answer (from async job if available, otherwise from initial response)
  const currentAnswer = answerData?.answer || results?.answer
  const currentCitations = answerData?.citations || results?.citations

  // Type for job result citation
  type JobCitation = { label: number; memory_id: string; title: string | null; url: string | null }

  // Deduplicate citations by document name, keeping track of memoryIds for preview
  const uniqueCitations = useMemo(() => {
    if (!currentCitations) return []

    const seen = new Map<string, { index: number; documentName: string; pageNumbers: number[]; memoryId: string }>()

    for (const citation of currentCitations) {
      // Handle both formats: from initial response and from job result
      let documentName: string | undefined
      let pageNumber: number | undefined
      let memoryId: string
      let index: number

      if ('documentName' in citation) {
        // Citation from initial search response
        documentName = citation.documentName
        pageNumber = citation.pageNumber
        memoryId = citation.memoryId
        index = citation.index
      } else {
        // Citation from job result
        const jobCitation = citation as JobCitation
        documentName = jobCitation.title || undefined
        pageNumber = undefined
        memoryId = jobCitation.memory_id
        index = jobCitation.label
      }

      const key = documentName || `memory-${index}`

      if (seen.has(key)) {
        // Add page number if it exists and isn't already in the list
        if (pageNumber) {
          const existing = seen.get(key)!
          if (!existing.pageNumbers.includes(pageNumber)) {
            existing.pageNumbers.push(pageNumber)
          }
        }
      } else {
        seen.set(key, {
          index,
          documentName: documentName || "Memory",
          pageNumbers: pageNumber ? [pageNumber] : [],
          memoryId,
        })
      }
    }

    return Array.from(seen.values())
  }, [currentCitations])

  return (
    <div className="space-y-6">
      {/* Search form */}
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={
              hasDocuments
                ? "Ask anything about your documents..."
                : "Upload documents to start searching"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!hasDocuments}
            className="flex-1 px-4 py-3 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim() || !hasDocuments}
            className="px-6 py-3 text-sm font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          Error: {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* AI Answer - show loading state or actual answer */}
          {(isLoadingAnswer || currentAnswer) && (
            <div className="border border-gray-200 bg-gray-50">
              <div className="px-4 py-2 border-b border-gray-200">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                  [AI ANSWER]
                </span>
                {isLoadingAnswer && (
                  <span className="ml-2 text-xs font-mono text-blue-500 animate-pulse">
                    Generating...
                  </span>
                )}
              </div>
              <div className="p-4">
                {isLoadingAnswer && !currentAnswer ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                    <span>
                      Analyzing documents and generating answer...
                      {answerElapsed > 0 && (
                        <span className="text-gray-400 ml-1">({answerElapsed}s)</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {currentAnswer}
                    </p>
                    {uniqueCitations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                          Sources
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {uniqueCitations.map((citation, idx) => (
                            <button
                              key={`${citation.documentName}-${idx}`}
                              onClick={() => handleCitationClick(citation.memoryId)}
                              className="px-2 py-1 text-xs font-mono bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                            >
                              {citation.documentName}
                              {citation.pageNumbers.length > 0 && (
                                <span className="text-gray-400">
                                  {" "}p.{citation.pageNumbers.sort((a, b) => a - b).join(", ")}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Cited Sources - only show documents that are cited in the AI answer */}
          {uniqueCitations.length > 0 && (() => {
            // Get cited memory IDs from the AI answer
            const citedMemoryIds = new Set(uniqueCitations.map(c => c.memoryId))

            // Filter results to only show cited documents
            const citedResults = results.results.filter(r => citedMemoryIds.has(r.memoryId))

            if (citedResults.length === 0) return null

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                    [CITED SOURCES]
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {citedResults.length} source{citedResults.length !== 1 && "s"}
                  </span>
                </div>

                <div className="border border-gray-200 divide-y divide-gray-100">
                  {citedResults.map((result) => (
                    <button
                      key={result.memoryId}
                      onClick={() => handleCitationClick(result.memoryId)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {result.documentName || result.title || "Document"}
                            </span>
                            {result.pageNumber && (
                              <span className="text-xs font-mono text-gray-400">
                                p.{result.pageNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {result.contentPreview}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-gray-400">
                            <span>{result.sourceType}</span>
                            <span>{Math.round(result.score * 100)}% match</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-gray-400">
                          →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Empty state */}
      {!results && !isSearching && !error && (
        <div className="text-center py-12">
          {hasDocuments ? (
            <>
              <div className="text-sm font-mono text-gray-600 mb-2">
                Search Your Documents
              </div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
                Ask questions in natural language and get AI-powered answers
                with citations.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "What are the key findings?",
                  "Summarize the main points",
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
          ) : (
            <>
              <div className="text-sm font-mono text-gray-600 mb-2">
                No Documents Yet
              </div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Upload documents in the Documents tab to start searching.
              </p>
            </>
          )}
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={closePreview}
        documentData={previewData}
        isLoading={previewLoading}
        error={previewError}
      />
    </div>
  )
}
