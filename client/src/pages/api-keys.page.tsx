import React, { useEffect, useState } from "react"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"
import { ApiKeyService, type ApiKeyInfo, type CreateApiKeyRequest } from "@/services/api-key.service"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EmptyState, ErrorMessage } from "@/components/ui/loading-spinner"
import { toast } from "sonner"
import { ApiKeyForm } from "@/components/api-keys/ApiKeyForm"

export const ApiKeys: React.FC = () => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKeyInfo | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch (error) {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchApiKeys = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await ApiKeyService.listApiKeys()
        setApiKeys(data)
      } catch (err) {
        const error = err as { message?: string }
        console.error("Error fetching API keys:", err)
        setError(error.message || "Failed to load API keys")
      } finally {
        setIsLoading(false)
      }
    }

    fetchApiKeys()
  }, [isAuthenticated])

  const handleCreate = async (data: CreateApiKeyRequest) => {
    try {
      const result = await ApiKeyService.createApiKey(data)
      setNewKey(result.key)
      setApiKeys([result.info, ...apiKeys])
      setIsCreateDialogOpen(false)
      toast.success("API key created successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to create API key")
      throw err
    }
  }

  const handleUpdate = async (id: string, data: Partial<CreateApiKeyRequest>) => {
    try {
      const updated = await ApiKeyService.updateApiKey(id, data)
      setApiKeys(apiKeys.map(key => (key.id === id ? updated : key)))
      setEditingKey(null)
      toast.success("API key updated successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to update API key")
      throw err
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return
    }

    try {
      await ApiKeyService.revokeApiKey(id)
      setApiKeys(apiKeys.map(key => (key.id === id ? { ...key, isActive: false } : key)))
      toast.success("API key revoked successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to revoke API key")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (key: ApiKeyInfo) => {
    if (!key.isActive) {
      return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Revoked</span>
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Expired</span>
    }
    return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Active</span>
  }

  if (!isAuthenticated) {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-mono text-gray-600">Loading API keys...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="API Keys" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">
            Create and manage API keys for programmatic access to your Cognia data.
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create API Key</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              <ApiKeyForm
                onSubmit={handleCreate}
                onCancel={() => setIsCreateDialogOpen(false)}
                initialData={null}
              />
            </DialogContent>
          </Dialog>
        </div>

        {newKey && (
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold mb-2">API Key Created</h3>
            <p className="text-sm text-gray-600 mb-4">
              Make sure to copy your API key now. You won't be able to see it again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-white rounded border font-mono text-sm break-all">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  copyToClipboard(newKey)
                  setNewKey(null)
                }}
              >
                Copy
              </Button>
            </div>
          </Card>
        )}

        {error && <ErrorMessage message={error} />}

        {apiKeys.length === 0 && !error ? (
          <EmptyState message="No API keys found. Create your first API key to get started." />
        ) : (
          <div className="space-y-4">
            {apiKeys.map(key => (
              <Card key={key.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{key.name}</h3>
                      {getStatusBadge(key)}
                    </div>
                    {key.description && (
                      <p className="text-sm text-gray-600 mb-2">{key.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Prefix: {key.keyPrefix}...</span>
                      <span>Created: {formatDate(key.created_at)}</span>
                      <span>Last used: {formatDate(key.lastUsedAt)}</span>
                      <span>Usage: {key.usageCount} requests</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      {key.memoryIsolation && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                          Isolated Memory Mesh
                        </span>
                      )}
                      {key.rateLimit && (
                        <span>
                          Rate limit: {key.rateLimit} requests
                          {key.rateLimitWindow ? ` per ${key.rateLimitWindow}s` : ""}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span>Expires: {formatDate(key.expiresAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingKey(key)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                      disabled={!key.isActive}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {editingKey && (
          <Dialog open={!!editingKey} onOpenChange={() => setEditingKey(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit API Key</DialogTitle>
              </DialogHeader>
              <ApiKeyForm
                onSubmit={data => handleUpdate(editingKey.id, data)}
                onCancel={() => setEditingKey(null)}
                initialData={editingKey}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

