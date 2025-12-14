import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { DeveloperAppService, type DeveloperAppInfo } from "@/services/developer-app.service"
import { PageHeader } from "@/components/shared/PageHeader"
import { AppStats } from "@/components/developer-apps/AppStats"
import { MemoryMesh3D } from "@/components/memories/mesh"
import { AppApiKeyManager } from "@/components/developer-apps/AppApiKeyManager"
import { Button } from "@/components/ui/button"
import { requireAuthToken } from "@/utils/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ArrowLeft, LayoutDashboard, Key, Network } from "lucide-react"
import { cn } from "@/lib/utils.lib"

type Tab = "overview" | "mesh" | "keys"

export const DeveloperAppDetails: React.FC = () => {
    const { appId } = useParams<{ appId: string }>()
    const navigate = useNavigate()
    const [app, setApp] = useState<DeveloperAppInfo | null>(null)
    const [stats, setStats] = useState<{
        totalMemories: number
        totalApiKeys: number
        activeApiKeys: number
        totalRequests: number
        recentMemories: Array<{
            id: string
            content: string
            created_at: string
            source: string
        }>
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>("overview")

    useEffect(() => {
        try {
            requireAuthToken()
        } catch {
            navigate("/login")
        }
    }, [navigate])

    useEffect(() => {
        if (!appId) return

        const fetchData = async () => {
            try {
                setIsLoading(true)
                const [appData, statsData] = await Promise.all([
                    DeveloperAppService.getDeveloperApp(appId),
                    DeveloperAppService.getAppStats(appId)
                ])
                setApp(appData)
                setStats(statsData)
            } catch (error) {
                console.error("Error fetching app details:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [appId])

    if (isLoading || !app) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    const SidebarItem = ({ id, label, icon: Icon }: { id: Tab; label: string; icon: React.ElementType }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={cn(
                "flex items-center gap-3 w-full px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    )

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <PageHeader
                pageName={`App: ${app.name}`}
                rightActions={
                    <Button variant="outline" size="sm" onClick={() => navigate("/developer-apps")}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Apps
                    </Button>
                }
            />

            <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex gap-8">
                {/* Sidebar */}
                <aside className="w-64 flex-shrink-0 sticky top-24 self-start space-y-6">
                    <div className="bg-card rounded-lg border border-border p-4 space-y-1">
                        <SidebarItem id="overview" label="Overview" icon={LayoutDashboard} />
                        <SidebarItem id="mesh" label="Memory Mesh" icon={Network} />
                        <SidebarItem id="keys" label="API Keys" icon={Key} />
                    </div>

                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Namespace</div>
                        <code className="text-xs bg-background px-2 py-1 rounded border border-border block break-all font-mono text-primary/80">
                            {app.meshNamespaceId}
                        </code>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-foreground capitalize">{activeTab.replace('-', ' ')}</h2>
                        <p className="text-muted-foreground text-sm mt-1">{app.description}</p>
                    </div>

                    {activeTab === "overview" && stats && (
                        <div className="space-y-6">
                            <AppStats stats={stats} onCreateKey={() => setActiveTab("keys")} />
                        </div>
                    )}

                    {activeTab === "mesh" && (
                        <div className="h-[600px] border border-border rounded-lg bg-card overflow-hidden relative shadow-sm">
                            <MemoryMesh3D
                                className="w-full h-full"
                                developerAppId={appId}
                                similarityThreshold={0.4}
                            />
                            <div className="absolute top-4 left-4 bg-card/90 p-2 rounded backdrop-blur text-xs border border-border shadow-sm text-foreground">
                                Showing isolated memories for <strong>{app.name}</strong>.
                            </div>
                        </div>
                    )}

                    {activeTab === "keys" && (
                        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
                            <AppApiKeyManager appId={appId!} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
