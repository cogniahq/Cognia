import { useEffect, useState } from "react"
import { useOrganization } from "@/contexts/organization.context"

import { UpcomingList } from "@/components/upcoming/UpcomingList"

interface UpcomingTabProps {
  slug: string
}

/**
 * Org-admin "Upcoming" tab — same UpcomingList component as the user
 * surface, but scoped to all org members rather than just the calling
 * user. Backend filtering is identical; only the allMembers flag changes.
 */
export default function UpcomingTab({ slug }: UpcomingTabProps) {
  const { currentOrganization, organizations } = useOrganization()
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null)

  useEffect(() => {
    const fromCurrent =
      currentOrganization?.slug === slug ? currentOrganization?.id : null
    const fromList = organizations.find((o) => o.slug === slug)?.id ?? null
    setResolvedOrgId(fromCurrent || fromList)
  }, [slug, currentOrganization, organizations])

  if (!resolvedOrgId) {
    return (
      <div className="text-xs font-mono text-gray-500 py-8 text-center">
        Loading organization...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-gray-600 uppercase tracking-wide">
        [UPCOMING] — extracted action items across all members
      </div>
      <UpcomingList organizationId={resolvedOrgId} allMembers />
    </div>
  )
}
