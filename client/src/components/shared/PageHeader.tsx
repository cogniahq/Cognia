import React from "react"
import { useAuth } from "@/contexts/auth.context"
import { useNavigate } from "react-router-dom"

import BriefingBadge from "@/components/briefing/BriefingBadge"

interface PageHeaderProps {
  pageName: string
  rightActions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  pageName,
  rightActions,
}) => {
  const navigate = useNavigate()
  const { accountType } = useAuth()

  // Determine the dashboard path based on account type
  const dashboardPath =
    accountType === "ORGANIZATION" ? "/organization" : "/memories"

  // Check if we're on the dashboard
  const currentPageLower = pageName.toLowerCase()
  const isDashboard =
    currentPageLower === "memories" || currentPageLower === "workspace"

  // Handle back navigation - go to dashboard instead of browser history
  // This avoids issues with OAuth redirects polluting browser history
  const handleBack = () => {
    navigate(dashboardPath)
  }

  // Show different nav buttons based on account type
  const allNavButtons =
    accountType === "ORGANIZATION"
      ? [
          { label: "Workspace", path: "/organization" },
          { label: "Integrations", path: "/integrations" },
          { label: "Briefings", path: "/briefings" },
          { label: "Profile", path: "/profile" },
        ]
      : [
          { label: "Memories", path: "/memories" },
          { label: "Analytics", path: "/analytics" },
          { label: "Integrations", path: "/integrations" },
          { label: "Briefings", path: "/briefings" },
          { label: "Profile", path: "/profile" },
        ]

  const navButtons = allNavButtons.filter(
    (btn) => !currentPageLower.includes(btn.label.toLowerCase())
  )

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              {!isDashboard && (
                <>
                  <button
                    onClick={handleBack}
                    className="text-sm font-medium text-gray-700 hover:text-black transition-colors relative group"
                  >
                    <span className="relative z-10">← Back</span>
                    <div className="absolute inset-0 bg-gray-100 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left -z-10 rounded"></div>
                  </button>
                  <div className="h-4 w-px bg-gray-300"></div>
                </>
              )}
              <div className="flex items-center gap-3">
                <img
                  src="/black-transparent.png"
                  alt="Cognia"
                  className="w-8 h-8"
                />
                <div className="text-sm font-medium text-gray-900">
                  {pageName}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {rightActions}
              {navButtons.map((btn) => (
                <button
                  key={btn.path}
                  onClick={() => (window.location.href = btn.path)}
                  className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors flex items-center gap-1.5"
                >
                  {btn.label}
                  {btn.label === "Briefings" && <BriefingBadge />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <div className="h-14" aria-hidden="true" />
    </>
  )
}
