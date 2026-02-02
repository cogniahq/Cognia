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
  Cloud,
  MessageSquare,
  Code,
  FileText,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Unplug
} from "lucide-react"

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  storage: <Cloud className="w-5 h-5" />,
  communication: <MessageSquare className="w-5 h-5" />,
  development: <Code className="w-5 h-5" />,
  productivity: <FileText className="w-5 h-5" />,
  crm: <FileText className="w-5 h-5" />,
  other: <FileText className="w-5 h-5" />,
}

// Status badge colors
const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-red-100 text-red-800",
  RATE_LIMITED: "bg-orange-100 text-orange-800",
  TOKEN_EXPIRED: "bg-red-100 text-red-800",
  DISCONNECTED: "bg-gray-100 text-gray-800",
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

  // Check for OAuth callback status
  useEffect(() => {
    const connectedProvider = searchParams.get("connected")
    const errorMessage = searchParams.get("error")

    if (connectedProvider) {
      // Clear the URL params and refresh data
      navigate("/integrations", { replace: true })
      loadIntegrations()
    }

    if (errorMessage) {
      setError(decodeURIComponent(errorMessage))
      navigate("/integrations", { replace: true })
    }
  }, [searchParams, navigate])

  // Auth check
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
      // Redirect to OAuth provider
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

  const isConnected = (provider: string) => {
    return connected.some((c) => c.provider === provider)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleString()
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Integrations" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600 font-mono text-sm">Loading integrations...</span>
          </div>
        </div>
      </div>
    )
  }

  // Group available integrations by category
  const groupedIntegrations = available.reduce((acc, integration) => {
    const category = integration.category || "other"
    if (!acc[category]) acc[category] = []
    acc[category].push(integration)
    return acc
  }, {} as Record<string, IntegrationInfo[]>)

  return (
    <div className="min-h-screen bg-white">
      <PageHeader pageName="Integrations" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-medium text-gray-900">Integrations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Connect external services to sync your data into Cognia
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Connected Integrations Section */}
        {connected.length > 0 && (
          <div className="mb-8">
            <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
              Connected
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connected.map((conn) => {
                const info = available.find((a) => a.id === conn.provider)
                return (
                  <div
                    key={conn.id}
                    className="border border-green-200 bg-green-50/30 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white border border-gray-200 flex items-center justify-center">
                          {categoryIcons[info?.category || "other"]}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-medium text-gray-900">
                            {info?.name || conn.provider}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 font-mono ${statusColors[conn.status]}`}>
                              {conn.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(conn.provider)}
                          disabled={syncingProvider === conn.provider}
                          className="text-xs font-mono"
                        >
                          {syncingProvider === conn.provider ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDisconnectDialog(conn.provider)}
                          className="text-xs font-mono text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Unplug className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 text-xs font-mono text-gray-500">
                      <div className="flex justify-between">
                        <span>Last synced:</span>
                        <span>{formatDate(conn.last_sync_at)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Frequency:</span>
                        <span>{conn.sync_frequency}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Available Integrations by Category */}
        {Object.entries(groupedIntegrations).map(([category, integrations]) => (
          <div key={category} className="mb-8">
            <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide flex items-center gap-2">
              {categoryIcons[category]}
              {category}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => {
                const connected = isConnected(integration.id)
                const isConnecting = connectingProvider === integration.id

                return (
                  <div
                    key={integration.id}
                    className={`border p-4 ${
                      connected
                        ? "border-green-200 bg-green-50/30"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 border border-gray-200 flex items-center justify-center">
                          {categoryIcons[integration.category]}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-medium text-gray-900">
                            {integration.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {integration.description}
                          </div>
                        </div>
                      </div>
                      {!connected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnect(integration.id)}
                          disabled={isConnecting}
                          className="text-xs font-mono"
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Connect
                            </>
                          )}
                        </Button>
                      )}
                      {connected && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-mono">Connected</span>
                        </div>
                      )}
                    </div>
                    {/* Capabilities */}
                    <div className="mt-3 flex gap-2">
                      {integration.capabilities.pullContent && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 font-mono">
                          Sync
                        </span>
                      )}
                      {integration.capabilities.webhooks && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 font-mono">
                          Real-time
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Empty state when no integrations available */}
        {available.length === 0 && !isLoading && (
          <div className="text-center py-12 border border-gray-200">
            <Cloud className="w-12 h-12 mx-auto text-gray-300" />
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
