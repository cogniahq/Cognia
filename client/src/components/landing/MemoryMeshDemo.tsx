import React, { Suspense, useEffect, useRef, useState } from "react"

import { mockMeshData } from "../../data/mock"
import { MemoryMesh3DPreview } from "./mesh-preview/MemoryMesh3DPreview"
import { Section } from "./Section"

const nodeTypes = [
  { type: "browser", label: "Browser", color: "#3B82F6" },
  { type: "manual", label: "Manual", color: "#22C55E" },
  { type: "extension", label: "Integration", color: "#F59E0B" },
  { type: "reasoning", label: "AI Generated", color: "#A855F7" },
]

const connectionStrengths = [
  { label: "Strong (>85%)", color: "#1F2937", opacity: 1 },
  { label: "Medium (>75%)", color: "#6B7280", opacity: 0.7 },
  { label: "Weak (<75%)", color: "#D1D5DB", opacity: 0.4 },
]

const teamMembers = [
  { id: "1", name: "Sarah Chen", role: "Admin", initials: "SC" },
  { id: "2", name: "Marcus Johnson", role: "Editor", initials: "MJ" },
  { id: "3", name: "Elena Rodriguez", role: "Viewer", initials: "ER" },
]

const teamDocuments = [
  { id: "d1", name: "Q4 Strategy.pdf", type: "pdf", uploadedBy: "Sarah" },
  {
    id: "d2",
    name: "Brand Guidelines.docx",
    type: "doc",
    uploadedBy: "Marcus",
  },
  { id: "d3", name: "Research Notes.md", type: "md", uploadedBy: "Elena" },
]

export const MemoryMeshDemo: React.FC = () => {
  const [isInView, setIsInView] = useState(false)
  const [activeTab, setActiveTab] = useState<"personal" | "team">("personal")
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  )
  const [pulseIntensity, setPulseIntensity] = useState(0)
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true)
          }
        })
      },
      { threshold: 0.2 }
    )

    const currentContainer = containerRef.current
    if (currentContainer) {
      observer.observe(currentContainer)
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer)
      }
    }
  }, [isInView])

  // Animate highlighted nodes and pulse when in view
  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    // Gradually highlight nodes
    const nodesToHighlight = ["1", "2", "5", "10", "15", "20"]
    nodesToHighlight.forEach((nodeId, index) => {
      timers.push(
        setTimeout(
          () => {
            setHighlightedNodes((prev) => new Set([...prev, nodeId]))
          },
          800 + index * 300
        )
      )
    })

    // Pulse effect
    timers.push(
      setTimeout(() => {
        setPulseIntensity(0.5)
      }, 2500)
    )

    timers.push(
      setTimeout(() => {
        setPulseIntensity(0)
      }, 3500)
    )

    // Switch to team view
    timers.push(
      setTimeout(() => {
        setActiveTab("team")
      }, 4500)
    )

    // Animate document uploads
    teamDocuments.forEach((doc, index) => {
      timers.push(
        setTimeout(
          () => {
            setUploadedDocs((prev) => new Set([...prev, doc.id]))
          },
          5200 + index * 400
        )
      )
    })

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isInView])

  return (
    <Section className="bg-transparent py-12 sm:py-16 lg:py-20 xl:py-24">
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes nodeGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5)); }
          50% { filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.8)); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3 sm:mb-4">
            Memory Mesh
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Knowledge Graph
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light font-editorial mb-3 sm:mb-4 px-2 sm:px-0">
            See your knowledge graph
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-700 px-4 sm:px-2 md:px-0 leading-relaxed">
            Watch as your memories connect into a living, interactive network.
            Start personal, then invite your team to share knowledge.
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          className="flex justify-center mb-6 sm:mb-8"
          style={{
            animation: isInView ? "slideInUp 0.6s ease-out 0.1s both" : "none",
          }}
        >
          <div className="inline-flex rounded-full border border-gray-200 p-1 bg-white shadow-sm">
            <button
              onClick={() => setActiveTab("personal")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                activeTab === "personal"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                activeTab === "team"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Team Workspace
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Left Panel - Changes based on tab */}
          <div
            className="lg:col-span-1 space-y-4"
            style={{
              animation: isInView
                ? "slideInUp 0.6s ease-out 0.2s both"
                : "none",
            }}
          >
            {activeTab === "personal" ? (
              <>
                {/* Node Types Legend */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Node Types
                  </p>
                  <div className="space-y-2.5">
                    {nodeTypes.map((nodeType) => (
                      <div
                        key={nodeType.type}
                        className="flex items-center gap-2.5"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: nodeType.color }}
                        />
                        <span className="text-sm text-gray-700">
                          {nodeType.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connection Strength Legend */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Connection Strength
                  </p>
                  <div className="space-y-2.5">
                    {connectionStrengths.map((strength) => (
                      <div
                        key={strength.label}
                        className="flex items-center gap-2.5"
                      >
                        <div
                          className="w-6 h-0.5 rounded-full"
                          style={{
                            backgroundColor: strength.color,
                            opacity: strength.opacity,
                          }}
                        />
                        <span className="text-sm text-gray-700">
                          {strength.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Mesh Stats
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Nodes</span>
                      <span className="text-sm font-mono text-gray-900">
                        {mockMeshData.nodes.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Connections</span>
                      <span className="text-sm font-mono text-gray-900">
                        {mockMeshData.edges.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Avg. Links</span>
                      <span className="text-sm font-mono text-gray-900">
                        {mockMeshData.metadata?.average_connections?.toFixed(
                          1
                        ) ?? "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Team Members */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Team Members
                  </p>
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700">
                          {member.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {member.name}
                          </p>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              member.role === "Admin"
                                ? "bg-purple-100 text-purple-700"
                                : member.role === "Editor"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shared Documents */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Shared Documents
                  </p>
                  <div className="space-y-2">
                    {teamDocuments.map((doc) => {
                      const isUploaded = uploadedDocs.has(doc.id)
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-300 ${
                            isUploaded
                              ? "bg-gray-50 border border-gray-200"
                              : "opacity-40"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono ${
                              doc.type === "pdf"
                                ? "bg-red-100 text-red-600"
                                : doc.type === "doc"
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {doc.type}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-800 truncate">
                              {doc.name}
                            </p>
                          </div>
                          {isUploaded && (
                            <svg
                              className="w-3.5 h-3.5 text-emerald-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Team Stats */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Team Knowledge
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Shared Nodes
                      </span>
                      <span className="text-sm font-mono text-gray-900">
                        127
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Documents</span>
                      <span className="text-sm font-mono text-gray-900">
                        {uploadedDocs.size}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Contributors
                      </span>
                      <span className="text-sm font-mono text-gray-900">3</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3D Mesh Preview */}
          <div
            className="lg:col-span-3 relative rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] overflow-hidden"
            style={{
              animation: isInView
                ? "fadeInScale 0.6s ease-out 0.4s both"
                : "none",
            }}
          >
            {/* Header bar for team view */}
            {activeTab === "team" && (
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                    <svg
                      className="w-3.5 h-3.5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                    [TEAM WORKSPACE]
                  </span>
                </div>
                <div className="flex items-center -space-x-1.5">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-700"
                    >
                      {member.initials}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={
                activeTab === "team"
                  ? "aspect-[4/3] sm:aspect-[16/9]"
                  : "aspect-[4/3] sm:aspect-[16/10]"
              }
            >
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex items-center gap-2 text-gray-500">
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-sm font-mono">Loading mesh...</span>
                    </div>
                  </div>
                }
              >
                <MemoryMesh3DPreview
                  meshData={mockMeshData}
                  highlightedNodes={highlightedNodes}
                  pulseIntensity={pulseIntensity}
                />
              </Suspense>
            </div>

            {/* Interaction hint */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gray-200 shadow-sm">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
                <span className="text-xs text-gray-600">
                  Drag to rotate, scroll to zoom
                </span>
              </div>

              {activeTab === "personal" && highlightedNodes.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-700 font-mono">
                    {highlightedNodes.size} nodes highlighted
                  </span>
                </div>
              )}

              {activeTab === "team" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
                  <svg
                    className="w-3.5 h-3.5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  <span className="text-xs text-emerald-700 font-mono">
                    Shared with team
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
