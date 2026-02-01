import { useState, useCallback, useMemo } from "react"
import { useOrganization } from "@/contexts/organization.context"
import * as organizationService from "@/services/organization/organization.service"
import type { OrganizationSearchResponse } from "@/types/organization"

export function OrganizationSearch() {
  const { currentOrganization, documents } = useOrganization()
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<OrganizationSearchResponse | null>(null)
  const [error, setError] = useState("")

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!query.trim() || !currentOrganization) return

      setIsSearching(true)
      setError("")
      setResults(null)

      try {
        const searchResults = await organizationService.searchOrganization(
          currentOrganization.slug,
          query.trim(),
          { limit: 20, includeAnswer: true }
        )
        setResults(searchResults)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        setIsSearching(false)
      }
    },
    [query, currentOrganization]
  )

  const hasDocuments = documents.length > 0

  // Deduplicate citations by document name
  const uniqueCitations = useMemo(() => {
    if (!results?.citations) return []

    const seen = new Map<string, { index: number; documentName: string; pageNumbers: number[] }>()

    for (const citation of results.citations) {
      const key = citation.documentName || `memory-${citation.index}`

      if (seen.has(key)) {
        // Add page number if it exists and isn't already in the list
        if (citation.pageNumber) {
          const existing = seen.get(key)!
          if (!existing.pageNumbers.includes(citation.pageNumber)) {
            existing.pageNumbers.push(citation.pageNumber)
          }
        }
      } else {
        seen.set(key, {
          index: citation.index,
          documentName: citation.documentName || "Memory",
          pageNumbers: citation.pageNumber ? [citation.pageNumber] : [],
        })
      }
    }

    return Array.from(seen.values())
  }, [results?.citations])

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
          {/* AI Answer */}
          {results.answer && (
            <div className="border border-gray-200 bg-gray-50">
              <div className="px-4 py-2 border-b border-gray-200">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                  [AI ANSWER]
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {results.answer}
                </p>
                {uniqueCitations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                      Sources
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uniqueCitations.map((citation, idx) => (
                        <span
                          key={`${citation.documentName}-${idx}`}
                          className="px-2 py-1 text-xs font-mono bg-white border border-gray-200 text-gray-600"
                        >
                          {citation.documentName}
                          {citation.pageNumbers.length > 0 && (
                            <span className="text-gray-400">
                              {" "}p.{citation.pageNumbers.sort((a, b) => a - b).join(", ")}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                [RELATED DOCUMENTS]
              </span>
              <span className="text-xs font-mono text-gray-400">
                {results.totalResults} result{results.totalResults !== 1 && "s"}
              </span>
            </div>

            {results.results.length > 0 ? (
              <div className="border border-gray-200 divide-y divide-gray-100">
                {results.results.map((result) => (
                  <div
                    key={result.memoryId}
                    className="p-4 hover:bg-gray-50 transition-colors"
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
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-gray-400 hover:text-gray-600"
                        >
                          →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs font-mono text-gray-500">
                No matching documents found
              </div>
            )}
          </div>
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
    </div>
  )
}
