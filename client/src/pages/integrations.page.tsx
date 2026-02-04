import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import {
  connectIntegration,
  disconnectIntegration,
  getAvailableIntegrations,
  getConnectedIntegrations,
  syncIntegration,
} from "@/services/integration/integration.service"
import { requireAuthToken } from "@/utils/auth"
import { Loader2 } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import type { ConnectedIntegration, IntegrationInfo } from "@/types/integration"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/PageHeader"

// Integration logos as inline SVGs
const IntegrationLogos: Record<string, React.ReactNode> = {
  slack: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
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
  google_drive: (
    <svg viewBox="0 0 87.3 78" className="w-6 h-6">
      <path
        fill="#0066da"
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
      />
      <path
        fill="#00ac47"
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
      />
      <path
        fill="#ea4335"
        d="m64.15 52 -13.75 23.8c1.35.8 2.85 1.2 4.5 1.2h31.5c1.65 0 3.15-.45 4.5-1.2z"
      />
      <path
        fill="#00832d"
        d="m43.65 25 13.75-23.8c-1.35-.8-2.85-1.2-4.5-1.2h-18.5c-1.65 0-3.15.45-4.5 1.2z"
      />
      <path fill="#2684fc" d="m43.65 25h-27.5l13.75 23.8z" />
      <path
        fill="#ffba00"
        d="m64.15 52h-27.5l-13.75 23.8c1.35.8 2.85 1.2 4.5 1.2h45.5c1.65 0 3.15-.45 4.5-1.2z"
      />
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path
        fill="currentColor"
        d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.214-.14c-.093-.514.28-.887.747-.933l3.221-.187zM2.1 1.155L16.149.06c1.726-.14 2.146-.047 3.22.7l4.436 3.127c.746.56.98.84.98 1.54v16.503c0 1.167-.42 1.867-1.912 1.96l-15.503.934c-1.12.046-1.68-.107-2.286-.887L1.457 19.34c-.7-.933-.98-1.633-.98-2.473V3.022c0-1.027.42-1.82 1.634-1.867z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path
        fill="currentColor"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path
        fill="#0061D5"
        d="M4.298 6.758L12 2.59l7.702 4.168v9.484L12 20.41l-7.702-4.168V6.758zM12 0L2 5.423v12.154L12 23l10-5.423V5.423L12 0zm0 7.384L7.527 9.808v4.384L12 16.616l4.473-2.424V9.808L12 7.384z"
      />
    </svg>
  ),
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const Integrations: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [available, setAvailable] = useState<IntegrationInfo[]>([])
  const [connected, setConnected] = useState<ConnectedIntegration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  )
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null)
  const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null)

  useEffect(() => {
    const connectedProvider = searchParams.get("connected")
    const errorMessage = searchParams.get("error")

    if (connectedProvider) {
      navigate("/integrations", { replace: true })
      loadIntegrations()
    }

    if (errorMessage) {
      setError(decodeURIComponent(errorMessage))
      navigate("/integrations", { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    if (!authLoading) {
      try {
        requireAuthToken()
      } catch {
        navigate("/login")
        return
      }
      if (isAuthenticated) {
        loadIntegrations()
      }
    }
  }, [authLoading, isAuthenticated, navigate])

  const loadIntegrations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [availableData, connectedData] = await Promise.all([
        getAvailableIntegrations(),
        getConnectedIntegrations(),
      ])
      setAvailable(availableData)
      setConnected(connectedData)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load integrations"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider)
    setError(null)
    try {
      const { authUrl } = await connectIntegration(provider)
      window.location.href = authUrl
    } catch (err) {
      setError(getErrorMessage(err, "Failed to connect integration"))
      setConnectingProvider(null)
    }
  }

  const handleDisconnect = async (provider: string) => {
    setError(null)
    try {
      await disconnectIntegration(provider)
      setDisconnectDialog(null)
      await loadIntegrations()
    } catch (err) {
      setError(getErrorMessage(err, "Failed to disconnect integration"))
    }
  }

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider)
    setError(null)
    try {
      await syncIntegration(provider)
      await loadIntegrations()
    } catch (err) {
      setError(getErrorMessage(err, "Failed to sync integration"))
    } finally {
      setSyncingProvider(null)
    }
  }

  const getConnectionInfo = (
    providerId: string
  ): ConnectedIntegration | undefined => {
    return connected.find((c) => c.provider === providerId)
  }

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "Connected",
      PAUSED: "Paused",
      ERROR: "Error",
      RATE_LIMITED: "Rate Limited",
      TOKEN_EXPIRED: "Reconnect Required",
    }
    return labels[status] || status
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Integrations" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500 font-mono text-xs">
              Loading...
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader pageName="Integrations" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-mono text-gray-900">Integrations</h1>
          <p className="text-xs text-gray-500 mt-1">
            Connect external services to sync your data
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-3 py-2 border border-gray-300 bg-gray-50 text-xs font-mono text-gray-700">
            {error}
          </div>
        )}

        {/* Integration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {available.map((integration) => {
            const connectionInfo = getConnectionInfo(integration.id)
            const isConnected = !!connectionInfo
            const isConnecting = connectingProvider === integration.id
            const isSyncing = syncingProvider === integration.id
            const status = connectionInfo?.status || null

            return (
              <div
                key={integration.id}
                className={`border p-4 ${
                  isConnected ? "border-gray-900 bg-gray-50" : "border-gray-200"
                }`}
              >
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 border border-gray-200 bg-white flex items-center justify-center">
                    {IntegrationLogos[integration.id] || (
                      <span className="text-sm font-mono text-gray-400">
                        {integration.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">
                        {integration.name}
                      </span>
                      {isConnected && status && (
                        <span
                          className={`text-xs font-mono ${
                            status === "ACTIVE"
                              ? "text-gray-900"
                              : "text-gray-500"
                          }`}
                        >
                          {status === "ACTIVE"
                            ? "Connected"
                            : getStatusLabel(status)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {integration.description}
                    </p>
                  </div>
                </div>

                {/* Connected info */}
                {isConnected && connectionInfo && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs font-mono text-gray-500">
                    Last synced:{" "}
                    {formatRelativeTime(connectionInfo.last_sync_at)}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {!isConnected ? (
                    <button
                      onClick={() => handleConnect(integration.id)}
                      disabled={isConnecting}
                      className="px-3 py-1.5 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Connecting...
                        </span>
                      ) : (
                        "Connect"
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSync(integration.id)}
                        disabled={isSyncing}
                        className="px-3 py-1.5 text-xs font-mono border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSyncing ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Syncing...
                          </span>
                        ) : (
                          "Sync"
                        )}
                      </button>
                      <button
                        onClick={() => setDisconnectDialog(integration.id)}
                        className="px-3 py-1.5 text-xs font-mono text-gray-400 hover:text-gray-600"
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {available.length === 0 && !isLoading && (
          <div className="text-center py-12 border border-gray-200">
            <div className="text-xs font-mono text-gray-500">
              No integrations available
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Configure integrations in your environment to enable them
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-600">
          Need a different integration? Let us know what you'd like to connect.
        </div>
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog
        open={!!disconnectDialog}
        onOpenChange={() => setDisconnectDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Disconnect Integration
            </DialogTitle>
            <DialogDescription className="text-xs">
              Your synced data will remain, but no new data will be synced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDisconnectDialog(null)}
              className="px-3 py-1.5 text-xs font-mono border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                disconnectDialog && handleDisconnect(disconnectDialog)
              }
              className="px-3 py-1.5 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800"
            >
              Disconnect
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Integrations
