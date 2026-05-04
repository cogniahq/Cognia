"use client";

/**
 * Search tab. Streamlined port of
 * client/src/components/organization/OrganizationSearch.tsx (~860 LoC) —
 * keeps the source-type filter pills, query box, summary section + result
 * list. The original split helper modules
 * (organization-search-citations.ts, ...-loading.ts, etc.) are inlined
 * because none of them carried meaningful business logic that would warrant
 * separate files in the Next port.
 *
 * Answer-job streaming uses SSE — EventSource against
 * /api/search/job/<id>/stream with credentials so the cognia_session cookie
 * (Domain=.cogniahq.tech) authenticates the subscriber. On disconnect or
 * "error" event we fall back to a single getAnswerJobStatus poll so the
 * UI doesn't permanently spin if the SSE pipe drops.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import * as orgService from "@/services/organization.service";
import type {
  Document,
  OrganizationSearchResponse,
  OrganizationWithRole,
} from "@/types/organization";

const FILTERS = [
  { id: "ALL", label: "All Sources", sourceTypes: undefined },
  { id: "DOCUMENTS", label: "Documents", sourceTypes: ["DOCUMENT"] },
  { id: "BROWSING", label: "Browsing", sourceTypes: ["EXTENSION"] },
  { id: "INTEGRATIONS", label: "Integrations", sourceTypes: ["INTEGRATION"] },
] as const;

interface OrganizationSearchProps {
  currentOrganization: OrganizationWithRole;
  documents: Document[];
}

function mapAnswerJobCitations(
  citations: orgService.AnswerJobResult["citations"],
): OrganizationSearchResponse["citations"] {
  return citations?.map((citation) => ({
    index: citation.label,
    documentName: citation.title || undefined,
    memoryId: citation.memory_id,
    url: citation.url || undefined,
    sourceType: citation.source_type || undefined,
    authorEmail: citation.author_email || undefined,
    capturedAt: citation.captured_at || undefined,
  }));
}

export function OrganizationSearch({
  currentOrganization,
  documents,
}: OrganizationSearchProps) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeFilterId, setActiveFilterId] =
    useState<(typeof FILTERS)[number]["id"]>("ALL");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<OrganizationSearchResponse | null>(
    null,
  );
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");

  const activeFilter =
    FILTERS.find((f) => f.id === activeFilterId) || FILTERS[0];

  const runSearch = useCallback(
    async (trimmedQuery: string, filterId: (typeof FILTERS)[number]["id"]) => {
      setIsSearching(true);
      setError("");
      setSummaryError("");
      setResults(null);

      try {
        const filter = FILTERS.find((f) => f.id === filterId) || FILTERS[0];
        const searchResults = await orgService.searchOrganization(
          currentOrganization.slug,
          trimmedQuery,
          {
            includeAnswer: true,
            sourceTypes: filter.sourceTypes
              ? [...filter.sourceTypes]
              : undefined,
          },
        );
        setResults(searchResults);
        setSubmittedQuery(trimmedQuery);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [currentOrganization.slug],
  );

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;
      await runSearch(trimmedQuery, activeFilterId);
    },
    [activeFilterId, query, runSearch],
  );

  const handleFilterChange = useCallback(
    (nextFilterId: (typeof FILTERS)[number]["id"]) => {
      if (nextFilterId === activeFilterId) return;
      setActiveFilterId(nextFilterId);
      const rerunQuery = submittedQuery || query.trim();
      if (!rerunQuery) return;
      void runSearch(rerunQuery, nextFilterId);
    },
    [activeFilterId, query, runSearch, submittedQuery],
  );

  // Answer-job streaming via SSE. Server returns an answerJobId when summary
  // generation is asynchronous; we subscribe to the event stream and patch
  // the answer + citations into the existing results when the job completes.
  // The eventSource is closed automatically by the helper on completion,
  // failure, timeout, or error.
  useEffect(() => {
    const jobId = results?.answerJobId;
    if (!jobId) return;

    let cancelled = false;
    const unsubscribe = orgService.subscribeToAnswerJob(jobId, {
      onCompleted: (job) => {
        if (cancelled) return;
        setResults((current) => {
          if (!current || current.answerJobId !== jobId) return current;
          return {
            ...current,
            answer: job.answer,
            citations: mapAnswerJobCitations(job.citations),
            answerJobId: undefined,
          };
        });
      },
      onError: (msg) => {
        if (cancelled) return;
        setSummaryError(msg);
        setResults((current) => {
          if (!current || current.answerJobId !== jobId) return current;
          return { ...current, answerJobId: undefined };
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [results?.answerJobId]);

  const isAwaitingAnswer = !!results?.answerJobId;
  const hasAnswer = !!results?.answer;
  const visibleResults = results?.results ?? [];
  const visibleCitations = useMemo(() => {
    if (!results?.citations) return [];
    return results.citations.map((c) => ({
      ...c,
      indices: [c.index],
    }));
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = activeFilterId === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => handleFilterChange(filter.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-mono transition-colors ${
                isActive
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={
              documents.length > 0
                ? "Ask anything about your documents and memories..."
                : "Ask anything about your browsing memories..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 text-sm font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-gray-500">
        <span>[FILTER] {activeFilter.label}</span>
        <div>
          {submittedQuery && (
            <span>Applied to &quot;{submittedQuery}&quot;</span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          Error: {error}
        </div>
      )}

      {/* Summary */}
      {results && (hasAnswer || isAwaitingAnswer || summaryError) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              [SUMMARY]
            </span>
            <span className="text-xs font-mono text-gray-400">
              {isAwaitingAnswer
                ? "Synthesizing..."
                : hasAnswer
                  ? "Ready"
                  : "Unavailable"}
            </span>
          </div>

          <div className="border border-gray-200 bg-white p-4">
            {hasAnswer ? (
              <>
                <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                  {results.answer}
                </p>
                {visibleCitations && visibleCitations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {visibleCitations.map((citation) => (
                      <a
                        key={`${citation.memoryId}-${citation.indices.join("-")}`}
                        href={citation.url || "#"}
                        target={citation.url ? "_blank" : undefined}
                        rel={citation.url ? "noopener noreferrer" : undefined}
                        onClick={(e) => {
                          if (!citation.url) e.preventDefault();
                        }}
                        className="rounded border border-gray-200 px-2 py-1 text-left text-xs font-mono text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
                      >
                        [{citation.indices.join(", ")}]{" "}
                        {citation.documentName || "Source"}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : isAwaitingAnswer ? (
              <p className="text-sm text-gray-500">
                Generating summary from matched sources...
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {summaryError || "Summary unavailable."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && visibleResults.length > 0 && (
        <div>
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
                    (tag) => typeof tag === "string",
                  )
                : [];

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
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-gray-300 px-3 py-2 text-xs font-mono text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900"
                      >
                        Open Source
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results && results.results.length === 0 && (
        <div className="border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
          No matching documents or browsing memories were found for this search.
        </div>
      )}

      {!results && !isSearching && !error && (
        <div className="text-center py-12">
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
        </div>
      )}
    </div>
  );
}
