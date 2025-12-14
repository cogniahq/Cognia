import React, { useEffect, useState } from "react"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"
import { DeveloperAppService, type DeveloperAppInfo, type CreateDeveloperAppRequest } from "@/services/developer-app.service"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EmptyState, ErrorMessage } from "@/components/ui/loading-spinner"
import { toast } from "sonner"
import { DeveloperAppForm } from "@/components/developer-apps/DeveloperAppForm"

export const DeveloperApps: React.FC = () => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [apps, setApps] = useState<DeveloperAppInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingApp, setEditingApp] = useState<DeveloperAppInfo | null>(null)

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

    const fetchApps = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await DeveloperAppService.listDeveloperApps()
        setApps(data)
      } catch (err) {
        const error = err as { message?: string }
        console.error("Error fetching developer apps:", err)
        setError(error.message || "Failed to load developer apps")
      } finally {
        setIsLoading(false)
      }
    }

    fetchApps()
  }, [isAuthenticated])

  const handleCreate = async (data: CreateDeveloperAppRequest) => {
    try {
      const app = await DeveloperAppService.createDeveloperApp(data)
      setApps([app, ...apps])
      setIsCreateDialogOpen(false)
      toast.success("Developer app created successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to create developer app")
      throw err
    }
  }

  const handleUpdate = async (id: string, data: Partial<CreateDeveloperAppRequest>) => {
    try {
      const updated = await DeveloperAppService.updateDeveloperApp(id, data)
      setApps(apps.map(app => (app.id === id ? updated : app)))
      setEditingApp(null)
      toast.success("Developer app updated successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to update developer app")
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this developer app? This action cannot be undone.")) {
      return
    }

    try {
      await DeveloperAppService.deleteDeveloperApp(id)
      setApps(apps.filter(app => app.id !== id))
      toast.success("Developer app deleted successfully")
    } catch (err) {
      const error = err as { message?: string }
      toast.error(error.message || "Failed to delete developer app")
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleString()
  }

  if (!isAuthenticated) {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-mono text-gray-600">Loading developer apps...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader pageName="Developer Apps" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-muted-foreground">
            Create and manage developer apps. Each app has its own isolated memory mesh namespace.
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create App</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader>
                <DialogTitle>Create Developer App</DialogTitle>
              </DialogHeader>
              <DeveloperAppForm
                onSubmit={handleCreate}
                onCancel={() => setIsCreateDialogOpen(false)}
                initialData={null}
              />
            </DialogContent>
          </Dialog>
        </div>

        {error && <ErrorMessage message={error} />}

        {apps.length === 0 && !error ? (
          <EmptyState title="No developer apps found. Create your first app to get started." />
        ) : (
          <div className="space-y-4">
            {apps.map(app => (
              <Card key={app?.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{app?.name}</h3>
                    </div>
                    {app?.description && (
                      <p className="text-sm text-muted-foreground mb-2">{app?.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span>Namespace: <code className="bg-secondary px-2 py-1 rounded text-foreground">{app?.meshNamespaceId}</code></span>
                      <span>Created: {formatDate(app?.created_at)}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/developer-apps/${app?.id}`)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Manage App
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/api-keys/${app?.id}`)}
                      >
                        API Keys
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingApp(app)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(app?.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {editingApp && (
          <Dialog open={!!editingApp} onOpenChange={() => setEditingApp(null)}>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader>
                <DialogTitle>Edit Developer App</DialogTitle>
              </DialogHeader>
              <DeveloperAppForm
                onSubmit={data => handleUpdate(editingApp.id, data)}
                onCancel={() => setEditingApp(null)}
                initialData={editingApp}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
