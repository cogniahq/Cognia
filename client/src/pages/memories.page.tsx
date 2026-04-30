import React, { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import {
  onboardingService,
  type OnboardingState,
} from "@/services/onboarding.service"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"

import { useMemories } from "@/hooks/use-memories"
import { useMemoryMeshInteraction } from "@/hooks/use-memory-mesh-interaction"
import { useSpotlightSearchState } from "@/hooks/use-spotlight-search-state"
import { MemoriesEmptyState } from "@/components/empty-states/MemoriesEmptyState"
import { MemoryMesh3D } from "@/components/memories/mesh"
import { SpotlightSearch } from "@/components/memories/spotlight-search"
import { SampleDataBanner } from "@/components/onboarding/SampleDataBanner"
import { CreateOrganizationDialog } from "@/components/organization/CreateOrganizationDialog"
import { PageHeader } from "@/components/shared/PageHeader"

export const Memories: React.FC = () => {
  const navigate = useNavigate()
  const { accountType, isLoading: authLoading } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch (error) {
      navigate("/login")
    }
  }, [navigate])

  // Redirect ORGANIZATION users to their dashboard
  useEffect(() => {
    if (!authLoading && accountType === "ORGANIZATION") {
      navigate("/organization")
    }
  }, [accountType, authLoading, navigate])

  const similarityThreshold = 0.3
  const { memories, totalMemoryCount } = useMemories()
  const [onboardingState, setOnboardingState] =
    useState<OnboardingState | null>(null)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [teamBannerDismissed, setTeamBannerDismissed] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    onboardingService
      .getState()
      .then(setOnboardingState)
      .catch(() => {
        // Best-effort; absence of state simply suppresses the banner.
      })
  }, [isAuthenticated])
  const {
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
  } = useSpotlightSearchState()

  const {
    clickedNodeId,
    setSelectedMemory,
    handleNodeClick,
    highlightedMemoryIds,
    memorySources,
    memoryUrls,
  } = useMemoryMeshInteraction(memories)

  if (!isAuthenticated) {
    return null
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
      }}
    >
      <PageHeader
        pageName="Memories"
        rightActions={
          <>
            <button
              onClick={() => navigate("/memories/v2")}
              className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300"
              data-testid="list-view-link"
            >
              List view
            </button>
            <button
              onClick={() => navigate("/memories/trash")}
              className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300"
              data-testid="trash-link"
            >
              Trash
            </button>
          </>
        }
      />

      {onboardingState && onboardingState.demoMemoryCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <SampleDataBanner
            demoMemoryCount={onboardingState.demoMemoryCount}
            onDismissed={() =>
              setOnboardingState((prev) =>
                prev
                  ? { ...prev, demoMemoryCount: 0, demoDismissed: true }
                  : prev
              )
            }
          />
        </div>
      )}

      {!teamBannerDismissed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="border border-gray-200 bg-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">
              Want to invite your team? Create a team workspace.
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowCreateOrg(true)}
                className="text-xs font-mono px-3 py-1.5 border border-gray-300 hover:border-black hover:bg-gray-900 hover:text-white transition-colors"
              >
                Create team workspace →
              </button>
              <button
                onClick={() => setTeamBannerDismissed(true)}
                className="text-xs font-mono text-gray-400 hover:text-gray-900"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateOrganizationDialog
        open={showCreateOrg}
        onOpenChange={setShowCreateOrg}
      />

      {memories.length === 0 && totalMemoryCount === 0 ? (
        <MemoriesEmptyState />
      ) : (
        <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] relative">
          <div
            className="flex-1 relative order-2 md:order-1 h-[50vh] md:h-auto md:min-h-[calc(100vh-3.5rem)] border-b md:border-b-0 bg-white"
            style={{
              backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
              backgroundSize: "24px 24px",
            }}
          >
            <MemoryMesh3D
              className="w-full h-full"
              onNodeClick={handleNodeClick}
              similarityThreshold={similarityThreshold}
              selectedMemoryId={clickedNodeId || undefined}
              highlightedMemoryIds={highlightedMemoryIds}
              memorySources={memorySources}
              memoryUrls={memoryUrls}
            />

            <div className="pointer-events-none absolute left-4 top-4 text-xs font-mono text-gray-500 uppercase tracking-wider">
              Memory Mesh
            </div>

            <div className="absolute right-4 top-4 z-20 max-w-[240px]">
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-900 p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Legend
                  </span>
                  <button
                    onClick={() => {
                      setIsSpotlightOpen(true)
                      setSpotlightSearchQuery("")
                    }}
                    className="text-xs font-medium text-gray-700 hover:text-black px-2 py-1 border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-all rounded-none"
                  >
                    Search
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Statistics
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-900">
                      <span>Nodes</span>
                      <span className="font-mono font-semibold">
                        {totalMemoryCount || memories.length}
                      </span>
                    </div>
                    {spotlightSearchResults &&
                      spotlightSearchResults.results && (
                        <div className="flex items-center justify-between text-xs text-gray-900">
                          <span>Connections</span>
                          <span className="font-mono font-semibold">
                            {spotlightSearchResults.results.length}
                          </span>
                        </div>
                      )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Node Types
                    </div>
                    <div className="space-y-1.5">
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />{" "}
                        Browser/Extension
                      </span>
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />{" "}
                        Manual/Docs
                      </span>
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />{" "}
                        Integrations
                      </span>
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />{" "}
                        Other
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Connections
                    </div>
                    <div className="space-y-1.5">
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-4 h-[1.5px] bg-blue-500" />
                        Strong (&gt;85%)
                      </span>
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-4 h-[1px] bg-sky-400" />
                        Medium (&gt;75%)
                      </span>
                      <span className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="inline-block w-4 h-[0.5px] bg-gray-400" />
                        Weak (&lt;75%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SpotlightSearch
            isOpen={isSpotlightOpen}
            searchQuery={spotlightSearchQuery}
            searchResults={spotlightSearchResults}
            isSearching={spotlightIsSearching}
            searchAnswer={spotlightSearchAnswer}
            searchCitations={spotlightSearchCitations}
            isEmbeddingOnly={spotlightEmbeddingOnly}
            onEmbeddingOnlyChange={setSpotlightEmbeddingOnly}
            onSearchQueryChange={setSpotlightSearchQuery}
            onSelectMemory={(memory) => {
              setSelectedMemory(memory)
              handleNodeClick(memory.id)
              setIsSpotlightOpen(false)
            }}
            onClose={() => {
              setIsSpotlightOpen(false)
              resetSpotlight()
            }}
          />
        </div>
      )}
    </div>
  )
}
