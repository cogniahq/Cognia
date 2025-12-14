import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, Database, Key, Server, Plus, BookOpen, Clock, BarChart3, ExternalLink } from "lucide-react"

interface AppStatsProps {
    stats: {
        totalMemories: number
        totalApiKeys: number
        activeApiKeys: number
        totalRequests: number
        recentMemories?: Array<{
            id: string
            content: string
            created_at: string
            source: string
        }>
    }
    onCreateKey?: () => void
}

export const AppStats: React.FC<AppStatsProps> = ({ stats, onCreateKey }) => {
    const navigate = useNavigate()

    return (
        <div className="space-y-6">
            {/* Quick Actions */}
            <div className="flex items-center gap-4">
                <Button onClick={onCreateKey} className="gap-2">
                    <Plus className="h-4 w-4" /> Create API Key
                </Button>
                <Button variant="outline" onClick={() => navigate("/docs")} className="gap-2">
                    <BookOpen className="h-4 w-4" /> View Documentation
                </Button>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Memories</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalMemories}</div>
                        <p className="text-xs text-muted-foreground">Stored in namespace</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRequests}</div>
                        <p className="text-xs text-muted-foreground">Lifetime API calls</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
                        <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeApiKeys}</div>
                        <p className="text-xs text-muted-foreground">Of {stats.totalApiKeys} total keys</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <Server className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Active</div>
                        <p className="text-xs text-muted-foreground">Namespace compliant</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                {/* Request Volume Chart (Mock) */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                            Request Volume (Last 30 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-end justify-between gap-2 px-4">
                            {[35, 45, 20, 60, 40, 75, 50, 65, 30, 80, 55, 90, 45, 60, 35, 85, 70, 50, 40, 95, 60, 75, 50, 80, 45, 60, 40, 55, 75, 65].map((height, i) => (
                                <div
                                    key={i}
                                    className="bg-primary/20 hover:bg-primary/40 transition-colors w-full rounded-t"
                                    style={{ height: `${height}%` }}
                                    title={`Day ${i + 1}: ${height} requests`}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity Feed */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            Recent Activity
                        </CardTitle>
                        <CardDescription>
                            Latest memories added to this app
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {(stats.recentMemories && stats.recentMemories.length > 0) ? (
                                stats.recentMemories.map((memory) => (
                                    <div key={memory.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                                        <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                                        <div className="space-y-1 overflow-hidden">
                                            <p className="text-sm font-medium leading-none truncate text-foreground">
                                                {memory.content.substring(0, 50)}...
                                            </p>
                                            <div className="flex items-center text-xs text-muted-foreground gap-2">
                                                <span>{new Date(memory.created_at).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <a href={memory.source} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-foreground">
                                                    Source <ExternalLink className="ml-1 h-3 w-3" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-muted-foreground py-4 text-center">
                                    No recent activity found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
