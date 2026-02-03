import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/contexts/auth.context"
import { requireAuthToken } from "@/utils/auth"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getAvailableIntegrations,
  getConnectedIntegrations,
  connectIntegration,
  disconnectIntegration,
  syncIntegration,
} from "@/services/integration/integration.service"
import type { IntegrationInfo, ConnectedIntegration } from "@/types/integration"
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react"

// Integration logos as inline SVGs
const IntegrationLogos: Record<string, React.ReactNode> = {
  slack: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"/>
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.527 2.527 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"/>
    </svg>
  ),
  google_drive: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path fill="currentColor" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.493-.933l-4.577-7.186v6.952l1.446.327s0 .84-1.167.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.214-.14c-.093-.514.28-.887.747-.933l3.221-.187zM2.1 1.155L16.149.06c1.726-.14 2.146-.047 3.22.7l4.436 3.127c.746.56.98.84.98 1.54v16.503c0 1.167-.42 1.867-1.912 1.96l-15.503.934c-1.12.046-1.68-.107-2.286-.887L1.457 19.34c-.7-.933-.98-1.633-.98-2.473V3.022c0-1.027.42-1.82 1.634-1.867z"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  ),
}

// Status configuration
const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  ACTIVE: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Connected"
  },
  PAUSED: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    label: "Paused"
  },
  ERROR: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Error"
  },
  RATE_LIMITED: {
    icon: <Clock className="w-4 h-4" />,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    label: "Rate Limited"
  },
  TOKEN_EXPIRED: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Token Expired"
  },
}

export const Integrations: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [available, setAvailable] = useState<IntegrationInfo[]>([])
  const [connected, setConnected] = useState<ConnectedIntegration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
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
    } catch (err: any) {
      setError(err.message || "Failed to load integrations")
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
    } catch (err: any) {
      setError(err.message || "Failed to connect integration")
      setConnectingProvider(null)
    }
  }

  const handleDisconnect = async (provider: string) => {
    setError(null)
    try {
      await disconnectIntegration(provider)
      setDisconnectDialog(null)
      await loadIntegrations()
    } catch (err: any) {
      setError(err.message || "Failed to disconnect integration")
    }
  }

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider)
    setError(null)
    try {
      await syncIntegration(provider)
      await loadIntegrations()
    } catch (err: any) {
      setError(err.message || "Failed to sync integration")
    } finally {
      setSyncingProvider(null)
    }
  }

  const getConnectionInfo = (providerId: string): ConnectedIntegration | undefined => {
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Integrations" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600 font-mono text-sm">Loading integrations...</span>
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
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-medium text-gray-900">Integrations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect external services to sync your data into Cognia
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Integration Cards */}
        <div className="space-y-4">
          {available.map((integration) => {
            const connectionInfo = getConnectionInfo(integration.id)
            const isConnected = !!connectionInfo
            const isConnecting = connectingProvider === integration.id
            const isSyncing = syncingProvider === integration.id
            const status = connectionInfo?.status || null
            const statusInfo = status ? statusConfig[status] : null

            return (
              <div
                key={integration.id}
                className={`border rounded-lg p-5 transition-all ${
                  isConnected && statusInfo
                    ? statusInfo.bg
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                    {IntegrationLogos[integration.id] || (
                      <span className="text-lg font-bold text-gray-400">
                        {integration.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{integration.description}</p>

                        {/* Capabilities */}
                        <div className="flex gap-2 mt-2">
                          {integration.capabilities.pullContent && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                              Sync
                            </span>
                          )}
                          {integration.capabilities.webhooks && (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                              Real-time
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0">
                        {!isConnected ? (
                          <Button
                            onClick={() => handleConnect(integration.id)}
                            disabled={isConnecting}
                            className="font-mono"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect"
                            )}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(integration.id)}
                              disabled={isSyncing}
                              className="font-mono"
                            >
                              {isSyncing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  Sync
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDisconnectDialog(integration.id)}
                              className="font-mono text-gray-500 hover:text-red-600"
                            >
                              Disconnect
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Connection Status */}
                    {isConnected && connectionInfo && (
                      <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center justify-between text-sm">
                        <div className={`flex items-center gap-1.5 ${statusInfo?.color || "text-gray-600"}`}>
                          {statusInfo?.icon}
                          <span className="font-medium">{statusInfo?.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-500 font-mono text-xs">
                          <span>
                            Last synced: {formatRelativeTime(connectionInfo.last_sync_at)}
                          </span>
                          <span className="text-gray-300">|</span>
                          <span>
                            {connectionInfo.sync_frequency?.replace("_", " ").toLowerCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {available.length === 0 && !isLoading && (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
            <div className="mt-4 text-sm font-mono text-gray-600">
              No integrations available
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Configure integrations in your environment to enable them
            </div>
          </div>
        )}
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog open={!!disconnectDialog} onOpenChange={() => setDisconnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">Disconnect Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect this integration? Your synced data will remain,
              but no new data will be synced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectDialog && handleDisconnect(disconnectDialog)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Integrations
