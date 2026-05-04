import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"

import { PageHeader } from "@/components/shared/PageHeader"
import { UpcomingList } from "@/components/upcoming/UpcomingList"

/**
 * Org-scoped "Upcoming" surface: the user's extracted TODOs / scheduled
 * events from captured memories, with one-click "Add to Google Calendar".
 * Calendar is connected from /integrations now.
 */
export function Upcoming() {
  const navigate = useNavigate()
  const { isLoading: authLoading } = useAuth()
  const { currentOrganization, organizations, loadOrganizations } =
    useOrganization()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (isAuthenticated && organizations.length === 0) {
      loadOrganizations()
    }
  }, [isAuthenticated, organizations.length, loadOrganizations])

  if (!isAuthenticated || authLoading) return null

  const orgId = currentOrganization?.id

  return (
    <div className="min-h-screen bg-white">
      <PageHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="space-y-6">
          <header>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Upcoming
            </div>
            <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
              Upcoming
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">
              Action items and scheduled events extracted from your captured
              memories.
            </p>
          </header>

          {!orgId ? (
            <div className="border border-gray-200 rounded-xl p-6 text-sm font-mono text-gray-600">
              Open an organization workspace to see extracted upcoming items.
            </div>
          ) : (
            <UpcomingList organizationId={orgId} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Upcoming
