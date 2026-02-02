import React, { useEffect, useState } from "react"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"

import { useMemories } from "@/hooks/use-memories"
import { useMemoryMeshInteraction } from "@/hooks/use-memory-mesh-interaction"
import { useSpotlightSearchState } from "@/hooks/use-spotlight-search-state"
import { MemoryMesh3D } from "@/components/memories/mesh"
import { SpotlightSearch } from "@/components/memories/spotlight-search"
import { PageHeader } from "@/components/shared/PageHeader"
import { useAuth } from "@/contexts/auth.context"

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
      <PageHeader pageName="Memories" />

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
                  {spotlightSearchResults && spotlightSearchResults.results && (
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
    </div>
  )
}
