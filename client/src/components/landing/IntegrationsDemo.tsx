import React, { useEffect, useRef, useState } from "react"

import { Section } from "./Section"

// Integration logos as inline SVGs (from integrations.page.tsx)
const IntegrationLogos: Record<string, React.ReactNode> = {
  slack: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.527 2.527 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"
      />
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path
        fill="currentColor"
        d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.214-.14c-.093-.514.28-.887.747-.933l3.221-.187zM2.1 1.155L16.149.06c1.726-.14 2.146-.047 3.22.7l4.436 3.127c.746.56.98.84.98 1.54v16.503c0 1.167-.42 1.867-1.912 1.96l-15.503.934c-1.12.046-1.68-.107-2.286-.887L1.457 19.34c-.7-.933-.98-1.633-.98-2.473V3.022c0-1.027.42-1.82 1.634-1.867z"
      />
    </svg>
  ),
  google_drive: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path fill="#0066DA" d="M4.433 22l3.3-5.715H22l-3.3 5.715z" />
      <path fill="#00AC47" d="M9.9 2L2 15.57l3.3 5.715 7.9-13.713z" />
      <path fill="#FFBA00" d="M9.9 2h8.067l7.9 13.713H17.8z" />
      <path fill="#00832D" d="M9.9 2L2 15.57h6.167L13.2 7.572z" />
      <path fill="#2684FC" d="M17.8 15.713H7.733l3.3 5.715h10.067z" />
      <path fill="#EA4335" d="M17.967 2H9.9l3.3 5.572h7.9z" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path
        fill="#0061D5"
        d="M4.298 6.758L12 2.59l7.702 4.168v9.484L12 20.41l-7.702-4.168V6.758zM12 0L2 5.423v12.154L12 23l10-5.423V5.423L12 0zm0 7.384L7.527 9.808v4.384L12 16.616l4.473-2.424V9.808L12 7.384z"
      />
    </svg>
  ),
}

const integrations = [
  {
    id: "slack",
    name: "Slack",
    description: "Sync messages and conversations",
    syncItems: ["#general", "#product", "#engineering"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync pages and databases",
    syncItems: ["Product Roadmap", "Meeting Notes", "Design Specs"],
  },
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Sync docs and files",
    syncItems: ["Q4 Planning.docx", "Budget.xlsx", "Slides.pptx"],
  },
  {
    id: "box",
    name: "Box",
    description: "Sync enterprise files",
    syncItems: ["Contracts", "Reports", "Archives"],
  },
]

export const IntegrationsDemo: React.FC = () => {
  const [isInView, setIsInView] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [connectedIntegrations, setConnectedIntegrations] = useState<
    Set<string>
  >(new Set())
  const [syncingIntegration, setSyncingIntegration] = useState<string | null>(
    null
  )
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

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    // Step 1: First integration connects
    timers.push(
      setTimeout(() => {
        setActiveStep(1)
        setSyncingIntegration("slack")
      }, 600)
    )

    timers.push(
      setTimeout(() => {
        setConnectedIntegrations(new Set(["slack"]))
        setSyncingIntegration("notion")
      }, 1400)
    )

    // Step 2: Second integration
    timers.push(
      setTimeout(() => {
        setActiveStep(2)
        setConnectedIntegrations(new Set(["slack", "notion"]))
        setSyncingIntegration("google_drive")
      }, 2200)
    )

    // Step 3: Third integration
    timers.push(
      setTimeout(() => {
        setActiveStep(3)
        setConnectedIntegrations(new Set(["slack", "notion", "google_drive"]))
        setSyncingIntegration("box")
      }, 3000)
    )

    // All connected
    timers.push(
      setTimeout(() => {
        setConnectedIntegrations(
          new Set(["slack", "notion", "google_drive", "box"])
        )
        setSyncingIntegration(null)
      }, 3800)
    )

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isInView])

  const flowSteps = [
    {
      step: 1,
      label: "Connect",
      description: "Link your favorite tools with one click",
    },
    {
      step: 2,
      label: "Sync",
      description: "Data flows automatically into your memory mesh",
    },
    {
      step: 3,
      label: "Search",
      description: "Find anything across all connected sources",
    },
  ]

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
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes dataFlow {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0; }
        }
      `}</style>

      <div ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3 sm:mb-4">
            Integrations
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Connect
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light font-editorial mb-3 sm:mb-4 px-2 sm:px-0">
            Connect your tools
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-700 px-4 sm:px-2 md:px-0 leading-relaxed">
            Sync conversations, documents, and files from the tools you already
            use. Everything becomes searchable in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Flow Steps */}
          <div className="lg:col-span-1 space-y-4">
            {flowSteps.map((item, index) => {
              const isActive = activeStep >= item.step
              return (
                <div key={item.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-medium transition-all duration-500 ${
                        isActive
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-400"
                      }`}
                    >
                      {item.step}
                    </div>
                    {index < flowSteps.length - 1 && (
                      <div
                        className={`w-px h-12 mt-2 transition-all duration-500 ${
                          isActive ? "bg-gray-900" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p
                      className={`text-sm font-medium mb-1 transition-colors duration-500 ${
                        isActive ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p
                      className={`text-xs leading-relaxed transition-colors duration-500 ${
                        isActive ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Integration Cards Grid */}
          <div className="lg:col-span-2 relative rounded-2xl border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] overflow-hidden p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {integrations.map((integration, index) => {
                const isConnected = connectedIntegrations.has(integration.id)
                const isSyncing = syncingIntegration === integration.id

                return (
                  <div
                    key={integration.id}
                    className={`relative border p-4 rounded-xl transition-all duration-500 ${
                      isConnected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white"
                    }`}
                    style={{
                      animation: isInView
                        ? `fadeInScale 0.5s ease-out ${0.2 + index * 0.15}s both`
                        : "none",
                    }}
                  >
                    {/* Syncing pulse effect */}
                    {isSyncing && (
                      <div className="absolute inset-0 rounded-xl overflow-hidden">
                        <div
                          className="absolute inset-0 border-2 border-blue-400 rounded-xl"
                          style={{ animation: "pulse-ring 1s ease-out infinite" }}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0">
                        {IntegrationLogos[integration.id]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {integration.name}
                          </span>
                          {isConnected && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Connected
                            </span>
                          )}
                          {isSyncing && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Syncing
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {integration.description}
                        </p>
                      </div>
                    </div>

                    {/* Sync items preview */}
                    <div className="space-y-1.5">
                      {integration.syncItems.map((item, itemIndex) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                            isConnected
                              ? "text-gray-700"
                              : "text-gray-400"
                          }`}
                          style={{
                            opacity: isConnected ? 1 : 0.5,
                            transform: isConnected
                              ? "translateX(0)"
                              : "translateX(-4px)",
                            transitionDelay: `${itemIndex * 100}ms`,
                          }}
                        >
                          <svg
                            className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${
                              isConnected ? "text-emerald-500" : "text-gray-300"
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            {isConnected ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            )}
                          </svg>
                          <span className="truncate font-mono">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Status bar */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500">
                {connectedIntegrations.size} of {integrations.length} connected
              </span>
              <div className="flex items-center gap-1.5">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      connectedIntegrations.has(integration.id)
                        ? "bg-emerald-500"
                        : syncingIntegration === integration.id
                          ? "bg-blue-400 animate-pulse"
                          : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
