import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import {
  getOrgIntegrationSettings,
  updateOrgIntegrationSettings,
  type OrgSyncSettings,
} from "@/services/integration/integration.service"
import { requireAuthToken } from "@/utils/auth"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
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
import { SetupChecklist } from "@/components/organization/setup"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  fadeUpVariants,
  staggerContainerVariants,
  tabContentVariants,
} from "@/components/shared/site-motion-variants"

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

  if (accountType === "PERSONAL") {
    return null
  }

  // Loading state
  if (isLoading && organizations.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500 font-primary">
            Loading workspace...
          </span>
        </motion.div>
      </div>
    )
  }

  // Empty state — no organizations
  if (!currentOrganization && organizations.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Workspace" />

        <motion.div
          className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
          initial="initial"
          animate="animate"
          variants={staggerContainerVariants}
        >
          <motion.div className="text-center mb-12" variants={fadeUpVariants}>
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
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12"
            variants={staggerContainerVariants}
          >
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
              <motion.div
                key={feature.id}
                className="border border-gray-200 bg-white p-5 sm:p-6 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300"
                variants={fadeUpVariants}
                whileHover={{ y: -2 }}
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
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="text-center" variants={fadeUpVariants}>
            <motion.button
              onClick={() => setShowCreateDialog(true)}
              className="group relative overflow-hidden border border-gray-300 px-6 py-3 transition-all duration-200 hover:border-black hover:shadow-sm bg-white/80 backdrop-blur"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              <span className="relative z-10 text-sm font-mono uppercase tracking-wide text-gray-900 group-hover:text-white transition-colors duration-500">
                + Create Workspace
              </span>
            </motion.button>
          </motion.div>
        </motion.div>

        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    )
  }

  // Organization selector — orgs exist but none selected
  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Workspace" />

        <motion.div
          className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16"
          initial="initial"
          animate="animate"
          variants={staggerContainerVariants}
        >
          <motion.div className="text-center mb-8" variants={fadeUpVariants}>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-4">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Select
            </div>
            <h1 className="text-2xl sm:text-3xl font-light font-editorial">
              Choose a workspace
            </h1>
          </motion.div>

          <motion.div
            className="space-y-3 mb-6"
            variants={staggerContainerVariants}
          >
            {organizations.map((org) => (
              <motion.button
                key={org.id}
                onClick={() => selectOrganization(org.slug)}
                className="w-full flex items-center justify-between p-4 sm:p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300 text-left group"
                variants={fadeUpVariants}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.995 }}
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
                <span className="text-gray-300 group-hover:text-gray-600 transition-colors duration-300">
                  →
                </span>
              </motion.button>
            ))}
          </motion.div>

          <motion.button
            onClick={() => setShowCreateDialog(true)}
            className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-900 transition-all duration-300"
            variants={fadeUpVariants}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.995 }}
          >
            + Create New Workspace
          </motion.button>
        </motion.div>

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
      <PageHeader pageName="Workspace" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          className="space-y-8"
          initial="initial"
          animate="animate"
          variants={staggerContainerVariants}
        >
          {/* Header */}
          <motion.div variants={fadeUpVariants}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
                  {currentOrganization.name}
                </h1>
                {currentOrganization.description && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {currentOrganization.description}
                  </p>
                )}
              </div>
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500">
                  <span className="font-mono">{documents.length}</span>
                  <span>docs</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500">
                  <span className="font-mono">{members.length}</span>
                  <span>members</span>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Setup Checklist */}
          {isAdmin && (
            <SetupChecklist
              organization={currentOrganization}
              onRefresh={() => selectOrganization(currentOrganization.slug)}
            />
          )}

          {/* Tabs */}
          <LayoutGroup id="organization-workspace-tabs">
            <motion.div
              className="flex gap-1 border-b border-gray-200"
              variants={fadeUpVariants}
            >
              {[
                { id: "search" as const, label: "Search" },
                { id: "mesh" as const, label: "Mesh" },
                { id: "documents" as const, label: "Documents" },
                { id: "members" as const, label: "Team" },
                ...(isAdmin
                  ? [{ id: "settings" as const, label: "Settings" }]
                  : []),
              ].map((tab) => {
                const isActive = activeTab === tab.id

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative overflow-hidden px-4 py-2.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="organization-workspace-active-tab"
                        className="absolute inset-0 bg-gray-900"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </motion.button>
                )
              })}
            </motion.div>
          </LayoutGroup>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              className={`bg-white border border-gray-200 rounded-xl shadow-sm min-h-[500px] ${activeTab === "mesh" ? "p-0 overflow-hidden" : "p-6 sm:p-8"}`}
              key={activeTab}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={tabContentVariants}
            >
              {activeTab === "search" && <OrganizationSearch />}

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
                  <motion.div
                    className="pointer-events-none absolute left-5 top-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/60 bg-white/80 backdrop-blur px-3 py-1 text-[10px] tracking-[0.2em] uppercase text-gray-500">
                      Knowledge
                      <span className="w-1 h-1 rounded-full bg-gray-400" />
                      Mesh
                    </div>
                  </motion.div>
                  {meshData && meshData.nodes.length > 0 && (
                    <motion.div
                      className="absolute right-5 top-5 z-20 max-w-[200px]"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
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
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === "documents" && (
                <motion.div
                  className="space-y-10"
                  initial="initial"
                  animate="animate"
                  variants={staggerContainerVariants}
                >
                  {canEdit && (
                    <motion.div variants={fadeUpVariants}>
                      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
                        Upload
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        Documents
                      </div>
                      <DocumentUpload />
                    </motion.div>
                  )}
                  <motion.div variants={fadeUpVariants}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Library
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        Documents
                      </div>
                      <span className="text-xs text-gray-500">
                        {documents.length} file
                        {documents.length !== 1 && "s"}
                      </span>
                    </div>
                    <DocumentList />
                  </motion.div>
                </motion.div>
              )}

              {activeTab === "members" && <MemberManagement />}

              {activeTab === "settings" && isAdmin && <OrganizationSettings />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
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

  const [syncSettings, setSyncSettings] = useState<OrgSyncSettings | null>(null)
  const [isLoadingSync, setIsLoadingSync] = useState(true)
  const [isSavingSync, setIsSavingSync] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selectedFrequency, setSelectedFrequency] = useState<string>("HOURLY")

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
    <motion.div
      className="space-y-10"
      initial="initial"
      animate="animate"
      variants={staggerContainerVariants}
    >
      {/* Workspace Info */}
      <motion.div variants={fadeUpVariants}>
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
      </motion.div>

      {/* Sync Settings */}
      <motion.div variants={fadeUpVariants}>
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
            <LayoutGroup id="sync-frequency">
              <div className="inline-flex border border-gray-200 rounded-full overflow-hidden">
                {SYNC_FREQUENCIES.map((freq) => (
                  <motion.button
                    key={freq.value}
                    onClick={() => handleSaveSyncSettings(freq.value)}
                    disabled={isSavingSync}
                    className={`relative overflow-hidden px-4 py-2 text-xs font-mono transition-colors ${
                      selectedFrequency === freq.value
                        ? "text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    {selectedFrequency === freq.value && (
                      <motion.span
                        layoutId="sync-frequency-active"
                        className="absolute inset-0 bg-gray-900"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10">{freq.label}</span>
                  </motion.button>
                ))}
              </div>
            </LayoutGroup>
            {syncSettings && (
              <motion.p
                className="text-xs text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Effective interval:{" "}
                <span className="font-mono">
                  {syncSettings.effectiveIntervalMin === 0
                    ? "Manual only"
                    : `${syncSettings.effectiveIntervalMin} min`}
                </span>
              </motion.p>
            )}
          </div>
        )}
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={fadeUpVariants}>
        <div className="inline-flex items-center gap-2 rounded-full border border-red-200 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-400 mb-4">
          Danger
          <span className="w-1 h-1 rounded-full bg-red-300" />
          Zone
        </div>
        <div className="border border-red-200 rounded-xl bg-red-50/30 overflow-hidden">
          <AnimatePresence mode="wait">
            {!showDeleteConfirm ? (
              <motion.div
                key="prompt"
                className="flex items-center justify-between px-5 py-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Delete this workspace
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Permanently remove workspace and all associated data
                  </div>
                </div>
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="group relative overflow-hidden border border-red-300 px-4 py-2 transition-all duration-200 hover:border-red-500"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="absolute inset-0 bg-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                  <span className="relative z-10 text-xs font-mono text-red-600 group-hover:text-white transition-colors duration-500">
                    Delete Workspace
                  </span>
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                className="px-5 py-5 space-y-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-xs text-red-700 leading-relaxed">
                  This action cannot be undone. All documents, members, and
                  settings will be permanently deleted.
                </p>
                <div>
                  <label className="block text-xs text-gray-600 mb-1.5">
                    Type "{currentOrganization.name}" to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    className="w-full max-w-sm px-3 py-2.5 border border-red-200 text-sm font-mono focus:outline-none focus:border-red-400 bg-white/80 backdrop-blur rounded-none"
                    placeholder="Enter workspace name"
                  />
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setConfirmDelete("")
                    }}
                    className="px-4 py-2 text-xs border border-gray-300 text-gray-600 hover:border-black hover:text-gray-900 transition-all duration-200"
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleDelete}
                    disabled={
                      confirmDelete !== currentOrganization.name || isDeleting
                    }
                    className="px-4 py-2 text-xs font-mono bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    {isDeleting ? "Deleting..." : "Delete Workspace"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
