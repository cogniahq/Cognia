import { useMemo } from "react"
import { useOrganization } from "@/contexts/organization.context"

export function SpacesOverview() {
  const { currentOrganization, documents } = useOrganization()

  const stats = useMemo(() => {
    const uploaded = documents.filter((document) => document.type !== "integration")
    const connected = documents.filter((document) => document.type === "integration")
    const completed = documents.filter((document) => document.status === "COMPLETED")

    return {
      total: documents.length,
      uploaded: uploaded.length,
      connected: connected.length,
      completed: completed.length,
    }
  }, [documents])

  if (!currentOrganization) {
    return (
      <div className="border border-dashed border-gray-300 py-16 text-center">
        <div className="text-sm font-mono text-gray-500">No workspace selected</div>
        <p className="mt-2 text-xs text-gray-400">
          Select an organization to review document routing and processing status.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 bg-gray-50 p-4">
        <div className="space-y-2">
          <div className="text-sm font-mono text-gray-600 uppercase tracking-wide">
            [SPACES]
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Workspace structure is still document-first
          </h2>
          <p className="max-w-2xl text-sm text-gray-600">
            The organization area does not have space CRUD wired yet. This panel
            currently reflects document inventory for {currentOrganization.name} so
            the website can build cleanly while the backend model catches up.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Total Docs
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</div>
          </div>
          <div className="border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Uploaded
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.uploaded}</div>
          </div>
          <div className="border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Connected
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.connected}</div>
          </div>
          <div className="border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Completed
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.completed}</div>
          </div>
        </div>
      </div>

      <div className="border border-dashed border-gray-300 bg-white p-6">
        <div className="text-sm font-mono text-gray-500">Spaces are not active yet</div>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          The UI previously expected organization space APIs that do not exist in the
          current client context or API surface. When that feature is implemented, this
          component should be reconnected to real organization space data instead of
          derived document counts.
        </p>
      </div>
    </div>
  )
}
