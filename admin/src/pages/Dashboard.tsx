import { useEffect, useState } from 'react'
import {
  Brain,
  Building2,
  DollarSign,
  Eye,
  FileText,
  HardDrive,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'

import { AreaChart, BarChart } from '@/components/charts'
import { Header } from '@/components/layout/Header'
import { FilePreviewModal } from '@/components/ui/FilePreviewModal'
import { StatCard } from '@/components/ui/StatCard'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { chartColors, formatBytes } from '@/lib/chart-config'
import {
  getDashboard,
  getDocumentDownloadUrl,
  getStorageAnalytics,
} from '@/services/api'
import type {
  DashboardStats,
  LargestFile,
  StorageAnalytics,
} from '@/types/admin.types'

function formatCost(cost: number): string {
  return '$' + cost.toFixed(2)
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [storageData, setStorageData] = useState<StorageAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // File preview state
  const [previewFile, setPreviewFile] = useState<LargestFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const [dashboardData, storage] = await Promise.all([
        getDashboard(),
        getStorageAnalytics(30),
      ])
      setStats(dashboardData)
      setStorageData(storage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFilePreview(file: LargestFile) {
    setPreviewFile(file)
    setPreviewUrl(null)
    setIsPreviewLoading(true)

    try {
      const { downloadUrl } = await getDocumentDownloadUrl(file.id)
      setPreviewUrl(downloadUrl)
    } catch (err) {
      console.error('Failed to get download URL:', err)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function closePreview() {
    setPreviewFile(null)
    setPreviewUrl(null)
    setIsPreviewLoading(false)
  }

  if (isLoading) {
    return (
      <>
        <Header title="Dashboard" subtitle="System overview and key metrics" />
        <div className="flex-1 p-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Loading...
          </div>
        </div>
      </>
    )
  }

  if (error || !stats) {
    return (
      <>
        <Header title="Dashboard" subtitle="System overview and key metrics" />
        <div className="flex-1 p-6">
          <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md text-xs font-mono text-destructive">
            {error || 'Failed to load dashboard'}
          </div>
        </div>
      </>
    )
  }

  // Prepare storage by org data for horizontal bar chart (top 5)
  const storageByOrgData =
    storageData?.storageByOrganization.slice(0, 5).map((org) => ({
      name: org.name.length > 12 ? org.name.slice(0, 12) + '...' : org.name,
      value: org.size,
    })) || []

  // Prepare storage by file type data for bar chart (top 6)
  const storageByTypeData =
    storageData?.storageByFileType.slice(0, 6).map((ft) => ({
      name: ft.mimeType.split('/')[1]?.slice(0, 8) || ft.mimeType.slice(0, 8),
      value: ft.size,
    })) || []

  return (
    <>
      <Header title="Dashboard" subtitle="System overview and key metrics" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* System Health */}
        <section className="mb-8">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            System Health
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatusIndicator
              status={stats.system.database}
              label="Database"
              detail="PostgreSQL"
            />
            <StatusIndicator
              status={stats.system.redis}
              label="Redis"
              detail={stats.system.redisMemory}
            />
            <StatusIndicator
              status={stats.system.qdrant}
              label="Qdrant"
              detail={`${stats.system.qdrantPoints.toLocaleString()} points`}
            />
            <StatusIndicator status={true} label="API" detail="Running" />
          </div>
        </section>

        {/* Key Metrics */}
        <section className="mb-8">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Key Metrics
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={stats.users.total}
              subValue={`${stats.users.active30d} active (30d)`}
              trend={stats.users.newThisWeek > 0 ? 'up' : 'neutral'}
              trendValue={`+${stats.users.newThisWeek} this week`}
              icon={<Users className="w-4 h-4" />}
            />
            <StatCard
              label="Organizations"
              value={stats.organizations.total}
              subValue={`${stats.organizations.byPlan['enterprise'] || 0} enterprise`}
              trend={stats.organizations.newThisWeek > 0 ? 'up' : 'neutral'}
              trendValue={`+${stats.organizations.newThisWeek} this week`}
              icon={<Building2 className="w-4 h-4" />}
            />
            <StatCard
              label="Total Memories"
              value={stats.memories.total}
              subValue={`+${stats.memories.newToday} today`}
              trend={stats.memories.newThisWeek > 0 ? 'up' : 'neutral'}
              trendValue={`+${stats.memories.newThisWeek} this week`}
              icon={<Brain className="w-4 h-4" />}
            />
            <StatCard
              label="Documents"
              value={stats.documents.total}
              subValue={formatBytes(stats.documents.totalSize)}
              icon={<FileText className="w-4 h-4" />}
            />
          </div>
        </section>

        {/* Activity & Usage */}
        <section className="mb-8">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            24h Activity
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Searches"
              value={stats.activity.searches24h}
              icon={<Search className="w-4 h-4" />}
            />
            <StatCard
              label="Memories Created"
              value={stats.activity.memoriesCreated24h}
              icon={<Brain className="w-4 h-4" />}
            />
            <StatCard
              label="Documents Uploaded"
              value={stats.activity.documentsUploaded24h}
              icon={<FileText className="w-4 h-4" />}
            />
            <StatCard
              label="Today's Tokens"
              value={(
                stats.tokenUsage.todayInput + stats.tokenUsage.todayOutput
              ).toLocaleString()}
              subValue="input + output"
            />
          </div>
        </section>

        {/* Storage Analytics */}
        {storageData && (
          <section className="mb-8">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Storage Analytics
            </div>

            {/* Storage Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Storage"
                value={formatBytes(storageData.totalStorage)}
                icon={<HardDrive className="w-4 h-4" />}
              />
              <StatCard
                label="30-Day Projection"
                value={formatBytes(storageData.projectedStorage.thirtyDay)}
                subValue={`+${formatBytes(storageData.projectedStorage.dailyGrowthRate)}/day`}
                trend="up"
                trendValue="projected"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="90-Day Projection"
                value={formatBytes(storageData.projectedStorage.ninetyDay)}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="File Types"
                value={storageData.storageByFileType.length}
                subValue="unique types"
              />
            </div>

            {/* Storage Charts */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Storage Growth Trend */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                  Storage Growth (30 Days)
                </div>
                <AreaChart
                  data={storageData.storageTrends}
                  name="Storage"
                  color={chartColors.primary}
                  gradientId="storageGrowthGradient"
                  formatValue={formatBytes}
                />
              </div>

              {/* Storage by Organization */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                  Storage by Organization (Top 5)
                </div>
                <BarChart
                  data={storageByOrgData}
                  layout="vertical"
                  color={chartColors.accent}
                  formatValue={formatBytes}
                  barSize={16}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Storage by File Type */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                  Storage by File Type
                </div>
                <BarChart
                  data={storageByTypeData}
                  multiColor
                  formatValue={formatBytes}
                  barSize={24}
                />
              </div>

              {/* Largest Files Table */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                  Largest Files (Top 5)
                </div>
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left text-xs font-mono text-muted-foreground uppercase">
                          File
                        </th>
                        <th className="pb-2 text-right text-xs font-mono text-muted-foreground uppercase">
                          Size
                        </th>
                        <th className="pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageData.largestFiles.slice(0, 5).map((file) => (
                        <tr
                          key={file.id}
                          className="border-b border-border/50 last:border-0 group"
                        >
                          <td className="py-2">
                            <div
                              className="text-sm text-foreground truncate max-w-[180px]"
                              title={file.name}
                            >
                              {file.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {file.organizationName}
                            </div>
                          </td>
                          <td className="py-2 text-right font-mono text-sm text-foreground">
                            {formatBytes(file.size)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleFilePreview(file)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                              title="Preview file"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Token Usage */}
        <section className="mb-8">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Token Usage
          </div>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Total Input Tokens"
              value={stats.tokenUsage.totalInput.toLocaleString()}
            />
            <StatCard
              label="Total Output Tokens"
              value={stats.tokenUsage.totalOutput.toLocaleString()}
            />
            <StatCard
              label="Estimated Cost"
              value={formatCost(stats.tokenUsage.estimatedCost)}
              icon={<DollarSign className="w-4 h-4" />}
            />
          </div>
        </section>

        {/* Breakdowns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Memory Types */}
          <section>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Memory Types
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {Object.entries(stats.memories.byType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
                >
                  <span className="text-sm text-foreground">{type}</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Document Status */}
          <section>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Document Status
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {Object.entries(stats.documents.byStatus).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground">{status}</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {count.toLocaleString()}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        </div>
      </div>
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={closePreview}
        file={previewFile}
        downloadUrl={previewUrl}
        isLoading={isPreviewLoading}
      />
    </>
  )
}
