import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import {
  getOrgIntegrationSettings,
  updateOrgIntegrationSettings,
  type OrgSyncSettings,
} from "@/services/integration/integration.service"
import { requireAuthToken } from "@/utils/auth"
import { Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import type { MemoryMeshNode } from "@/types/memory"
import { useOrganizationMesh } from "@/hooks/use-organization-mesh"
import { MemoryMesh3D } from "@/components/memories/mesh"
import { CreateOrganizationDialog } from "@/components/organization/CreateOrganizationDialog"
import { DocumentList } from "@/components/organization/DocumentList"
import { DocumentUpload } from "@/components/organization/DocumentUpload"
import { MemberManagement } from "@/components/organization/MemberManagement"
import { OrganizationSearch } from "@/components/organization/OrganizationSearch"
import { OrganizationSelector } from "@/components/organization/OrganizationSelector"
import { SetupChecklist } from "@/components/organization/setup"
import { PageHeader } from "@/components/shared/PageHeader"

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export function Organization() {
  const navigate = useNavigate()
  const { accountType, isLoading: authLoading } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const {
    organizations,
    currentOrganization,
    isLoading,
    loadOrganizations,
    selectOrganization,
    documents,
    members,
  } = useOrganization()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<
    "search" | "mesh" | "documents" | "members" | "settings"
  >("search")

  // Memory mesh state - hooks must be called before any conditional returns
  const {
    meshData,
    isLoading: meshLoading,
    error: meshError,
  } = useOrganizationMesh(currentOrganization?.slug || null)
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<MemoryMeshNode | null>(null)

  const handleNodeClick = useCallback(
    (memoryId: string) => {
      const nodeInfo = meshData?.nodes.find((n) => n.id === memoryId)
      if (nodeInfo) {
        setSelectedNode(nodeInfo)
      }
      setClickedNodeId(memoryId)
    },
    [meshData]
  )

  const highlightedMemoryIds = useMemo(
    () => [
      ...(clickedNodeId ? [clickedNodeId] : []),
      ...(selectedNode ? [selectedNode.id] : []),
    ],
    [clickedNodeId, selectedNode]
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

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  // Redirect PERSONAL users to their dashboard
  useEffect(() => {
    if (!authLoading && accountType === "PERSONAL") {
      navigate("/memories")
    }
  }, [accountType, authLoading, navigate])

  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations()
    }
  }, [isAuthenticated, loadOrganizations])

  if (!isAuthenticated) {
    return null
  }

  // Don't render if wrong account type
  if (accountType === "PERSONAL") {
    return null
  }

  // Loading state
  if (isLoading && organizations.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm font-mono text-gray-600">
          Loading workspace...
        </div>
      </div>
    )
  }

  // Empty state - no organizations
  if (!currentOrganization && organizations.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Workspace" />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <div className="text-sm font-mono text-gray-600 uppercase tracking-wider mb-4">
              [TEAM WORKSPACE]
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Create Your First Workspace
            </h1>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              A workspace lets your team upload documents and search them with
              AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {[
              {
                title: "Upload Documents",
                description: "PDFs, Word docs, images, and text files",
              },
              {
                title: "AI-Powered Search",
                description: "Natural language queries with citations",
              },
              {
                title: "Team Permissions",
                description: "Admin, Editor, and Viewer roles",
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white border border-gray-200 p-4">
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                  [{String(index + 1).padStart(2, "0")}]
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="px-6 py-2 text-sm font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              + Create Workspace
            </button>
          </div>
        </div>

        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    )
  }

  // Organization selector when orgs exist but none selected
  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Workspace" />

        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <div className="text-sm font-mono text-gray-600 uppercase tracking-wider mb-2">
              [SELECT WORKSPACE]
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Choose a Workspace
            </h1>
          </div>

          <div className="space-y-2 mb-6">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => selectOrganization(org.slug)}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 hover:border-gray-400 transition-colors text-left"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {org.name}
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    {org.memberCount || 1} member
                    {(org.memberCount || 1) !== 1 && "s"}
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateDialog(true)}
            className="w-full p-4 border-2 border-dashed border-gray-300 text-sm font-mono text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + Create New Workspace
          </button>
        </div>

        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    )
  }

  const isAdmin = currentOrganization.userRole === "ADMIN"
  const canEdit = isAdmin || currentOrganization.userRole === "EDITOR"

  // Main organization view
  return (
    <div className="min-h-screen bg-white">
      <PageHeader
        pageName="Workspace"
        rightActions={
          <div className="flex items-center gap-3">
            <OrganizationSelector />
            <span className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700">
              {currentOrganization.userRole}
            </span>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {currentOrganization.name}
              </h1>
              <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                <span>{documents.length} docs</span>
                <span>{members.length} members</span>
              </div>
            </div>
            {currentOrganization.description && (
              <p className="text-xs text-gray-600">
                {currentOrganization.description}
              </p>
            )}
          </div>

          {/* Setup Checklist (shows for admins when setup incomplete) */}
          {isAdmin && (
            <SetupChecklist
              organization={currentOrganization}
              onRefresh={() => selectOrganization(currentOrganization.slug)}
            />
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { id: "search" as const, label: "Search" },
              { id: "mesh" as const, label: "Mesh" },
              { id: "documents" as const, label: "Documents" },
              { id: "members" as const, label: "Team" },
              ...(isAdmin
                ? [{ id: "settings" as const, label: "Settings" }]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-mono transition-colors ${
                  activeTab === tab.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className={`bg-white border border-gray-200 min-h-[500px] ${activeTab === "mesh" ? "p-0" : "p-6"}`}
          >
            {activeTab === "search" && <OrganizationSearch />}

            {activeTab === "mesh" && (
              <div
                className="relative"
                style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
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
                    onNodeClick={handleNodeClick}
                    similarityThreshold={0.3}
                    selectedMemoryId={clickedNodeId || undefined}
                    highlightedMemoryIds={highlightedMemoryIds}
                    memorySources={memorySources}
                    memoryUrls={memoryUrls}
                    externalMeshData={meshData}
                    externalIsLoading={meshLoading}
                    externalError={meshError}
                  />
                </div>
                <div className="pointer-events-none absolute left-4 top-4 text-xs font-mono text-gray-500 uppercase tracking-wider">
                  Knowledge Mesh
                </div>
                {meshData && meshData.nodes.length > 0 && (
                  <div className="absolute right-4 top-4 z-20 max-w-[200px]">
                    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-900 p-3 shadow-lg">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                        Statistics
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-900">
                          <span>Nodes</span>
                          <span className="font-mono font-semibold">
                            {meshData.nodes.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-900">
                          <span>Connections</span>
                          <span className="font-mono font-semibold">
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
              <div className="space-y-8">
                {canEdit && (
                  <div>
                    <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
                      [UPLOAD DOCUMENTS]
                    </div>
                    <DocumentUpload />
                  </div>
                )}
                <div>
                  <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
                    [DOCUMENT LIBRARY] — {documents.length} file
                    {documents.length !== 1 && "s"}
                  </div>
                  <DocumentList />
                </div>
              </div>
            )}

            {activeTab === "members" && <MemberManagement />}

            {activeTab === "settings" && isAdmin && <OrganizationSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

function OrganizationSettings() {
  const { currentOrganization, deleteOrganization } = useOrganization()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sync settings state
  const [syncSettings, setSyncSettings] = useState<OrgSyncSettings | null>(null)
  const [isLoadingSync, setIsLoadingSync] = useState(true)
  const [isSavingSync, setIsSavingSync] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selectedFrequency, setSelectedFrequency] = useState<string>("HOURLY")

  // Sync frequency options
  const SYNC_FREQUENCIES = [
    { value: "REALTIME", label: "Real-time" },
    { value: "FIFTEEN_MIN", label: "15 min" },
    { value: "HOURLY", label: "Hourly" },
    { value: "DAILY", label: "Daily" },
    { value: "MANUAL", label: "Manual" },
  ]

  const loadSyncSettings = useCallback(async () => {
    if (!currentOrganization?.slug) return
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
  }, [currentOrganization?.slug])

  useEffect(() => {
    loadSyncSettings()
  }, [loadSyncSettings])

  const handleSaveSyncSettings = async (frequency: string) => {
    if (!currentOrganization?.slug) return
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
    if (!currentOrganization || confirmDelete !== currentOrganization.name)
      return

    setIsDeleting(true)
    try {
      await deleteOrganization(currentOrganization.slug)
      navigate("/organization")
    } catch (err) {
      console.error("Failed to delete organization:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!currentOrganization) return null

  return (
    <div className="space-y-8">
      {/* Workspace Info */}
      <div>
        <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
          [WORKSPACE INFO]
        </div>
        <div className="border border-gray-200 divide-y divide-gray-100">
          <div className="grid grid-cols-3 gap-4 px-4 py-3">
            <div className="text-xs font-mono text-gray-500 uppercase">
              Name
            </div>
            <div className="col-span-2 text-sm text-gray-900">
              {currentOrganization.name}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 px-4 py-3">
            <div className="text-xs font-mono text-gray-500 uppercase">ID</div>
            <div className="col-span-2 text-sm font-mono text-gray-600">
              {currentOrganization.slug}
            </div>
          </div>
          {currentOrganization.description && (
            <div className="grid grid-cols-3 gap-4 px-4 py-3">
              <div className="text-xs font-mono text-gray-500 uppercase">
                Description
              </div>
              <div className="col-span-2 text-sm text-gray-600">
                {currentOrganization.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Settings */}
      <div>
        <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
          [SYNC SETTINGS]
        </div>

        {syncError && (
          <div className="mb-4 px-3 py-2 border border-gray-300 bg-gray-50 text-xs font-mono text-gray-700">
            {syncError}
          </div>
        )}

        {isLoadingSync ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs font-mono text-gray-500">Loading...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sync Frequency */}
            <div>
              <div className="text-xs text-gray-500 mb-3">
                How often should integrations sync new content?
              </div>
              <div className="inline-flex border border-gray-200 divide-x divide-gray-200">
                {SYNC_FREQUENCIES.map((freq) => (
                  <button
                    key={freq.value}
                    onClick={() => handleSaveSyncSettings(freq.value)}
                    disabled={isSavingSync}
                    className={`px-4 py-2 text-xs font-mono transition-colors ${
                      selectedFrequency === freq.value
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
              {syncSettings && (
                <div className="mt-3 text-xs text-gray-500">
                  Effective interval:{" "}
                  <span className="font-mono">
                    {syncSettings.effectiveIntervalMin === 0
                      ? "Manual only"
                      : `${syncSettings.effectiveIntervalMin} min`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div>
        <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
          [DANGER ZONE]
        </div>
        <div className="border border-red-200 bg-red-50/50">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <div className="text-sm text-gray-900">
                  Delete this workspace
                </div>
                <div className="text-xs text-gray-500">
                  Permanently remove workspace and all associated data
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-xs font-mono text-red-600 border border-red-300 hover:bg-red-100 transition-colors"
              >
                Delete Workspace
              </button>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4">
              <div className="text-xs text-red-700">
                This action cannot be undone. All documents, members, and
                settings will be permanently deleted.
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-600 mb-1">
                  Type "{currentOrganization.name}" to confirm
                </label>
                <input
                  type="text"
                  value={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.value)}
                  className="w-full max-w-sm px-3 py-2 border border-red-300 text-sm font-mono focus:outline-none focus:border-red-500 bg-white"
                  placeholder="Enter workspace name"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setConfirmDelete("")
                  }}
                  className="px-4 py-2 text-xs font-mono border border-gray-300 text-gray-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
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
