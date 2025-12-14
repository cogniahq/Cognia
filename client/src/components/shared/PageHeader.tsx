import React from "react"
import { useNavigate } from "react-router-dom"

interface PageHeaderProps {
  pageName: string
  rightActions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  pageName,
  rightActions,
}) => {
  const navigate = useNavigate()

  const allNavButtons = [
    { label: "Memories", path: "/memories" },
    { label: "Analytics", path: "/analytics" },
    { label: "Profile", path: "/profile" },
  ]

  const currentPageLower = pageName.toLowerCase()
  const navButtons = allNavButtons.filter(
    (btn) => !currentPageLower.includes(btn.label.toLowerCase())
  )

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => navigate(-1)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                <span className="relative z-10">← Back</span>
                <div className="absolute inset-0 bg-muted transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left -z-10 rounded"></div>
              </button>
              <div className="h-4 w-px bg-border"></div>
              <div className="flex items-center gap-3">
                <img
                  src="/black-transparent.png"
                  alt="Cognia"
                  className="w-8 h-8"
                />
                <div className="text-sm font-medium text-foreground">
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
                  className="px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors"
                >
                  {btn.label}
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
