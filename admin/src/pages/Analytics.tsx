import { useEffect, useState } from 'react'
import { format } from 'date-fns'

import { AreaChart, LineChart } from '@/components/charts'
import { Header } from '@/components/layout/Header'
import { chartColors } from '@/lib/chart-config'
import { getAnalytics } from '@/services/api'
import type { AnalyticsData } from '@/types/admin.types'

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    loadAnalytics()
  }, [days])

  async function loadAnalytics() {
    setIsLoading(true)
    try {
      const analytics = await getAnalytics(days)
      setData(analytics)
    } catch (err) {
      console.error('Failed to load analytics', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !data) {
    return (
      <>
        <Header title="Analytics" subtitle="Platform analytics and trends" />
        <div className="flex-1 p-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Loading...
          </div>
        </div>
      </>
    )
  }

  const formatXAxis = (dateStr: string) => format(new Date(dateStr), 'MM/dd')

  return (
    <>
      <Header title="Analytics" subtitle="Platform analytics and trends" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Period Filter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Period:
          </span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                days === d
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50 hover:bg-muted'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* User Growth - Area Chart */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              User Growth
            </div>
            <AreaChart
              data={data.userGrowth}
              name="New Users"
              color={chartColors.primary}
              gradientId="userGrowthGradient"
              formatXAxis={formatXAxis}
            />
          </section>

          {/* Memory Growth - Area Chart */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Memory Growth
            </div>
            <AreaChart
              data={data.memoryGrowth}
              name="New Memories"
              color={chartColors.accent}
              gradientId="memoryGrowthGradient"
              formatXAxis={formatXAxis}
            />
          </section>

          {/* Search Activity - Line Chart */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Search Activity
            </div>
            <LineChart
              data={data.searchActivity}
              name="Searches"
              color={chartColors.secondary}
              formatXAxis={formatXAxis}
            />
          </section>

          {/* Token Usage - Area Chart */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Token Usage
            </div>
            <AreaChart
              data={data.tokenUsage}
              name="Tokens"
              color={chartColors.success}
              gradientId="tokenUsageGradient"
              formatXAxis={formatXAxis}
            />
          </section>
        </div>

        {/* Top Users */}
        <section className="mt-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Top Users by Activity
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Memories
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Searches
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, i) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-4">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground">
                          {user.email || 'No email'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                      {user.memoryCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                      {user.searchCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
