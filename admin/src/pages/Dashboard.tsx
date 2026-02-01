import { useState, useEffect } from 'react'
import { Users, Building2, Brain, FileText, Search, DollarSign } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { getDashboard } from '@/services/api'
import type { DashboardStats } from '@/types/admin.types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatCost(cost: number): string {
  return '$' + cost.toFixed(2)
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const data = await getDashboard()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="Dashboard" subtitle="System overview and key metrics" />
        <div className="flex-1 p-6">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
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
          <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
            {error || 'Failed to load dashboard'}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Dashboard" subtitle="System overview and key metrics" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* System Health */}
        <section className="mb-8">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [SYSTEM HEALTH]
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
            <StatusIndicator
              status={true}
              label="API"
              detail="Running"
            />
          </div>
        </section>

        {/* Key Metrics */}
        <section className="mb-8">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [KEY METRICS]
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
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [24H ACTIVITY]
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
              value={(stats.tokenUsage.todayInput + stats.tokenUsage.todayOutput).toLocaleString()}
              subValue="input + output"
            />
          </div>
        </section>

        {/* Token Usage */}
        <section className="mb-8">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [TOKEN USAGE]
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
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [MEMORY TYPES]
            </div>
            <div className="bg-white border border-gray-200">
              {Object.entries(stats.memories.byType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-900">{type}</span>
                  <span className="text-sm font-mono text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Document Status */}
          <section>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [DOCUMENT STATUS]
            </div>
            <div className="bg-white border border-gray-200">
              {Object.entries(stats.documents.byStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-900">{status}</span>
                  <span className="text-sm font-mono text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
