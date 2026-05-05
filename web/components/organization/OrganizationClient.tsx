"use client"

/**
 * Workspace landing — full client port of client/src/pages/organization.page.tsx.
 *
 * Renders four tabs:
 *   1. Search   → OrganizationSearch (text query + filter pills + answer + results)
 *   2. Mesh     → MemoryMesh3D wrapped via next/dynamic (ssr: false)
 *   3. Documents → DocumentList + DocumentUpload
 *   4. Settings → OrganizationSettings (admin-only, sync settings + danger zone)
 *
 * Empty / selector states are reachable when the user belongs to zero or
 * multiple workspaces. The (app) layout already redirects users with no
 * memberships to /onboarding/workspace, but the empty state still ships
 * because deleting your last workspace lands you here without that redirect.
 *
 * State source-of-truth:
 *   - Per-page session (user, primaryOrg) comes from the SessionProvider
 *     hydrated by the (app) layout — see web/lib/auth/client.tsx.
 *   - Per-workspace details (description, role) and per-tab data
 *     (documents, members) are loaded via useOrganizationData on mount.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useOrganizationData } from "@/hooks/use-organization-data"
import { useOrganizationMesh } from "@/hooks/use-organization-mesh"
import {
  getOrgIntegrationSettings,
  updateOrgIntegrationSettings,
  type OrgSyncSettings,
} from "@/services/organization.service"
import type { MemoryMeshNode } from "@/types/memory"
import type { OrganizationWithRole } from "@/types/organization"

import { CreateOrganizationDialog } from "./CreateOrganizationDialog"
import { DocumentList } from "./DocumentList"
import { DocumentUpload } from "./DocumentUpload"
import { OrganizationSearch } from "./OrganizationSearch"
import { SetupChecklist } from "./SetupChecklist"

import MemoryMesh3D from "@/components/memories/mesh/MemoryMesh3DClient"

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

interface OrganizationClientProps {
  initialOrgSlug: string | null
}

type TabId = "search" | "mesh" | "documents" | "settings"

export function OrganizationClient({
  initialOrgSlug,
}: OrganizationClientProps) {
  const data = useOrganizationData(initialOrgSlug)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("search")

  // Mesh state lives at the page level so node selection persists across
  // tab switches.
  const {
    meshData,
    isLoading: meshLoading,
    error: meshError,
  } = useOrganizationMesh(data.currentOrganization?.slug || null)
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null)

  const handleNodeClick = useCallback((memoryId: string) => {
    setClickedNodeId(memoryId)
  }, [])

  const highlightedMemoryIds = useMemo(
    () => (clickedNodeId ? [clickedNodeId] : []),
    [clickedNodeId]
  )

  const memorySources = useMemo(
    () =>
      Object.fromEntries(
        (meshData?.nodes || []).map((n) => [
          n.id,
          (n as MemoryMeshNode & { source?: string }).source || "",
        ])
      ),
    [meshData]
  )

  const memoryUrls = useMemo(
    () =>
      Object.fromEntries(
        (meshData?.nodes || []).map((n) => [
          n.id,
          (n as MemoryMeshNode & { url?: string }).url || "",
        ])
      ),
    [meshData]
  )

  // Loading state — initial fetch in flight, no orgs known yet.
  if (data.isLoading && data.organizations.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500 font-primary">
            Loading workspace...
          </span>
        </div>
      </div>
    )
  }

  // Empty state — user has zero workspaces.
  if (!data.currentOrganization && data.organizations.length === 0) {
    return (
      <>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-4">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Get Started
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light font-editorial mb-4">
              Create your first workspace
            </h1>
            <p className="text-sm sm:text-base text-gray-700 max-w-md mx-auto leading-relaxed">
              A workspace lets your team upload documents and search them with
              AI-powered intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12">
            {[
              {
                id: "01",
                title: "Upload Documents",
                description: "PDFs, Word docs, images, and text files",
              },
              {
                id: "02",
                title: "AI-Powered Search",
                description: "Natural language queries with citations",
              },
              {
                id: "03",
                title: "Team Permissions",
                description: "Admin, Editor, and Viewer roles",
              },
            ].map((feature) => (
              <div
                key={feature.id}
                className="border border-gray-200 bg-white p-5 sm:p-6 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">
                  <span className="font-mono text-[9px] text-gray-600">
                    {feature.id}
                  </span>
                  {feature.title.split(" ")[0]}
                </div>
                <h3 className="text-base sm:text-lg font-light font-editorial text-black mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="border border-gray-300 px-6 py-3 hover:border-black hover:shadow-sm bg-white/80 backdrop-blur transition-colors"
            >
              <span className="text-sm font-mono uppercase tracking-wide text-gray-900">
                + Create Workspace
              </span>
            </button>
          </div>
        </div>

        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreate={data.createOrganization}
        />
      </>
    )
  }

  // Workspace selector — orgs exist but none selected.
  if (!data.currentOrganization) {
    return (
      <>
        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-4">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Select
            </div>
            <h1 className="text-2xl sm:text-3xl font-light font-editorial">
              Choose a workspace
            </h1>
          </div>

          <div className="space-y-3 mb-6">
            {data.organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => data.selectOrganization(org.slug)}
                className="w-full flex items-center justify-between p-4 sm:p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300 text-left"
              >
                <div>
                  <div className="text-sm sm:text-base font-medium text-gray-900">
                    {org.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {org.memberCount || 1} member
                    {(org.memberCount || 1) !== 1 && "s"}
                  </div>
                </div>
                <span className="text-gray-300">→</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateDialog(true)}
            className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + Create New Workspace
          </button>
        </div>

        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreate={data.createOrganization}
        />
      </>
    )
  }

  const isAdmin = data.currentOrganization.userRole === "ADMIN"
  const canEdit = isAdmin || data.currentOrganization.userRole === "EDITOR"

  const tabs = [
    { id: "search" as const, label: "Search" },
    { id: "mesh" as const, label: "Mesh" },
    { id: "documents" as const, label: "Documents" },
    ...(isAdmin ? [{ id: "settings" as const, label: "Settings" }] : []),
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
                {data.currentOrganization.name}
              </h1>
              {data.currentOrganization.description && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {data.currentOrganization.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500">
                <span className="font-mono">{data.documents.length}</span>
                <span>docs</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500">
                <span className="font-mono">{data.members.length}</span>
                <span>members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Setup checklist (admin only) */}
        {isAdmin && <SetupChecklist organization={data.currentOrganization} />}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative overflow-hidden px-4 py-2.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content. Re-mounted on activeTab change (key) so each tab
            gets a fresh render. We deliberately do NOT use AnimatePresence
            mode="wait" — its enforced old-fades-out → new-fades-in
            sequencing left the container empty for ~120ms between tabs.
            Mirrors the simplified pattern used in /org-admin. */}
        <div
          key={activeTab}
          className={`bg-white border border-gray-200 rounded-xl shadow-sm min-h-[500px] ${
            activeTab === "mesh" ? "p-0 overflow-hidden" : "p-6 sm:p-8"
          }`}
        >
          {activeTab === "search" && (
            <OrganizationSearch
              currentOrganization={data.currentOrganization}
              documents={data.documents}
            />
          )}

          {activeTab === "mesh" && (
            <div
              className="relative"
              style={{
                height: "calc(100vh - 300px)",
                minHeight: "500px",
              }}
            >
              <div
                className="w-full h-full"
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
                  meshData={meshData}
                  isLoading={meshLoading}
                  error={meshError}
                  onNodeClick={handleNodeClick}
                  selectedMemoryId={clickedNodeId || undefined}
                  highlightedMemoryIds={highlightedMemoryIds}
                  memorySources={memorySources}
                  memoryUrls={memoryUrls}
                />
              </div>
              <div className="pointer-events-none absolute left-5 top-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/60 bg-white/80 backdrop-blur px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-gray-500">
                  Knowledge
                  <span className="w-1 h-1 rounded-full bg-gray-400" />
                  Mesh
                </div>
              </div>
              {meshData && meshData.nodes.length > 0 && (
                <div className="absolute right-5 top-5 z-20 max-w-[200px]">
                  <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-3">
                      Statistics
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-700">
                        <span>Nodes</span>
                        <span className="font-mono font-medium text-gray-900">
                          {meshData.nodes.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-700">
                        <span>Connections</span>
                        <span className="font-mono font-medium text-gray-900">
                          {meshData.edges.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-10">
              {canEdit && (
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
                    Upload
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    Documents
                  </div>
                  <DocumentUpload
                    onUpload={data.uploadDocument}
                    onPollStatus={data.refreshDocumentStatus}
                  />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    Library
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    Documents
                  </div>
                  <span className="text-xs text-gray-500">
                    {data.documents.length} file
                    {data.documents.length !== 1 && "s"}
                  </span>
                </div>
                <DocumentList
                  documents={data.documents}
                  isAdmin={isAdmin}
                  onDelete={data.deleteDocument}
                />
              </div>
            </div>
          )}

          {activeTab === "settings" && isAdmin && (
            <OrganizationSettings
              currentOrganization={data.currentOrganization}
              onDelete={data.deleteOrganization}
            />
          )}
        </div>
      </div>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={data.createOrganization}
      />
    </div>
  )
}

interface OrganizationSettingsProps {
  currentOrganization: OrganizationWithRole
  onDelete: (slug: string) => Promise<void>
}

const SYNC_FREQUENCIES = [
  { value: "REALTIME", label: "Real-time" },
  { value: "FIFTEEN_MIN", label: "15 min" },
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "MANUAL", label: "Manual" },
]

function OrganizationSettings({
  currentOrganization,
  onDelete,
}: OrganizationSettingsProps) {
  const router = useRouter()

  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [syncSettings, setSyncSettings] = useState<OrgSyncSettings | null>(null)
  const [isLoadingSync, setIsLoadingSync] = useState(true)
  const [isSavingSync, setIsSavingSync] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selectedFrequency, setSelectedFrequency] = useState<string>("HOURLY")

  const loadSyncSettings = useCallback(async () => {
    setIsLoadingSync(true)
    setSyncError(null)
    try {
      const settings = await getOrgIntegrationSettings(currentOrganization.slug)
      setSyncSettings(settings)
      setSelectedFrequency(settings.defaultSyncFrequency)
    } catch (err) {
      setSyncError(getErrorMessage(err, "Failed to load settings"))
    } finally {
      setIsLoadingSync(false)
    }
  }, [currentOrganization.slug])

  useEffect(() => {
    loadSyncSettings()
  }, [loadSyncSettings])

  const handleSaveSyncSettings = async (frequency: string) => {
    setSelectedFrequency(frequency)
    setIsSavingSync(true)
    setSyncError(null)
    try {
      const updated = await updateOrgIntegrationSettings(
        currentOrganization.slug,
        { defaultSyncFrequency: frequency, customSyncIntervalMin: null }
      )
      setSyncSettings(updated)
    } catch (err) {
      setSyncError(getErrorMessage(err, "Failed to save settings"))
    } finally {
      setIsSavingSync(false)
    }
  }

  const handleDelete = async () => {
    if (confirmDelete !== currentOrganization.name) return
    setIsDeleting(true)
    try {
      await onDelete(currentOrganization.slug)
      router.push("/organization")
    } catch (err) {
      console.error("Failed to delete organization:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Workspace info */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
          Workspace
          <span className="w-1 h-1 rounded-full bg-gray-400" />
          Info
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Name
            </div>
            <div className="col-span-2 text-sm text-gray-900">
              {currentOrganization.name}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              ID
            </div>
            <div className="col-span-2 text-sm font-mono text-gray-600">
              {currentOrganization.slug}
            </div>
          </div>
          {currentOrganization.description && (
            <div className="grid grid-cols-3 gap-4 px-5 py-3.5">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Description
              </div>
              <div className="col-span-2 text-sm text-gray-600">
                {currentOrganization.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync settings */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
          Sync
          <span className="w-1 h-1 rounded-full bg-gray-400" />
          Settings
        </div>

        {syncError && (
          <div className="mb-4 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-xs text-gray-700">
            {syncError}
          </div>
        )}

        {isLoadingSync ? (
          <div className="flex items-center gap-2 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              How often should integrations sync new content?
            </p>
            <div className="inline-flex border border-gray-200 rounded-full overflow-hidden">
              {SYNC_FREQUENCIES.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => handleSaveSyncSettings(freq.value)}
                  disabled={isSavingSync}
                  className={`relative px-4 py-2 text-xs font-mono transition-colors ${
                    selectedFrequency === freq.value
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
            {syncSettings && (
              <p className="text-xs text-gray-500">
                Effective interval:{" "}
                <span className="font-mono">
                  {syncSettings.effectiveIntervalMin === 0
                    ? "Manual only"
                    : `${syncSettings.effectiveIntervalMin} min`}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-red-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-400 mb-4">
          Danger
          <span className="w-1 h-1 rounded-full bg-red-300" />
          Zone
        </div>
        <div className="border border-red-200 rounded-xl bg-red-50/30 overflow-hidden">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between px-5 py-5">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Delete this workspace
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Permanently remove workspace and all associated data
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="border border-red-300 px-4 py-2 hover:border-red-500 transition-colors"
              >
                <span className="text-xs font-mono text-red-600">
                  Delete Workspace
                </span>
              </button>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs text-red-700 leading-relaxed">
                This action cannot be undone. All documents, members, and
                settings will be permanently deleted.
              </p>
              <div>
                <label className="block text-xs text-gray-600 mb-1.5">
                  Type &quot;{currentOrganization.name}&quot; to confirm
                </label>
                <input
                  type="text"
                  value={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.value)}
                  className="w-full max-w-sm px-3 py-2.5 border border-red-200 text-sm font-mono focus:outline-none focus:border-red-400 bg-white/80 backdrop-blur"
                  placeholder="Enter workspace name"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setConfirmDelete("")
                  }}
                  className="px-4 py-2 text-xs border border-gray-300 text-gray-600 hover:border-black hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    confirmDelete !== currentOrganization.name || isDeleting
                  }
                  className="px-4 py-2 text-xs font-mono bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? "Deleting..." : "Delete Workspace"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
