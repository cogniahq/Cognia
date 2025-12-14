import React, { useEffect, useState } from "react"
import { ApiKeyService, type ApiKeyInfo, type CreateApiKeyRequest } from "@/services/api-key.service"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"
import { ApiKeyForm } from "@/components/api-keys/ApiKeyForm"

interface AppApiKeyManagerProps {
    appId: string
}

export const AppApiKeyManager: React.FC<AppApiKeyManagerProps> = ({ appId }) => {
    const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [editingKey, setEditingKey] = useState<ApiKeyInfo | null>(null)
    const [newKey, setNewKey] = useState<string | null>(null)

    useEffect(() => {
        if (!appId) return

        const fetchKeys = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const keysData = await ApiKeyService.listApiKeys(appId)
                setApiKeys(keysData)
            } catch (err) {
                const error = err as { message?: string }
                console.error("Error fetching api keys:", err)
                setError(error.message || "Failed to load API keys")
            } finally {
                setIsLoading(false)
            }
        }

        fetchKeys()
    }, [appId])

    const handleCreate = async (data: CreateApiKeyRequest) => {
        if (!appId) return
        try {
            const result = await ApiKeyService.createApiKey(appId, data)
            setNewKey(result.api_key)
            const newKeyInfo: ApiKeyInfo = {
                id: result.id,
                keyPrefix: result.prefix,
                lastFour: result.last_four,
                name: data.name,
                description: data.description,
                rateLimit: data.rateLimit,
                rateLimitWindow: data.rateLimitWindow,
                expiresAt: data.expiresAt,
                isActive: true,
                lastUsedAt: null,
                usageCount: 0,
                created_at: result.created_at,
            }
            setApiKeys([newKeyInfo, ...apiKeys])
            setIsCreateDialogOpen(false)
            toast.success("API key created successfully")
        } catch (err) {
            const error = err as { message?: string }
            toast.error(error.message || "Failed to create API key")
            throw err
        }
    }

    const handleUpdate = async (id: string, data: Partial<CreateApiKeyRequest>) => {
        if (!appId) return
        try {
            const updated = await ApiKeyService.updateApiKey(appId, id, data)
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
        if (!appId) return
        if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
            return
        }

        try {
            await ApiKeyService.revokeApiKey(appId, id)
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-foreground">API Keys</h3>
                    <p className="text-sm text-muted-foreground">Manage access keys for this application.</p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Create API Key</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-card">
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
                <Card className="p-6 bg-primary/5 border-primary/20">
                    <h3 className="font-semibold mb-2 text-foreground">API Key Created</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Make sure to copy your API key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-background rounded border border-border font-mono text-sm break-all text-foreground">
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
                <EmptyState title="No API keys found." />
            ) : (
                <div className="space-y-4">
                    {apiKeys.map(key => (
                        <Card key={key.id} className="p-6 bg-card">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-foreground">{key.name}</h3>
                                        {getStatusBadge(key)}
                                    </div>
                                    {key.description && (
                                        <p className="text-sm text-muted-foreground mb-2">{key.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>Prefix: {key.keyPrefix}...{key.lastFour}</span>
                                        <span>Created: {formatDate(key.created_at)}</span>
                                        <span>Usage: {key.usageCount} requests</span>
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
    )
}
