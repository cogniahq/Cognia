import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { Header } from '@/components/layout/Header'
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
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
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
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Period:
          </span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs font-mono border transition-colors ${
                days === d
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* User Growth */}
          <section className="bg-white border border-gray-200 p-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [USER GROWTH]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxis}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="New Users"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Memory Growth */}
          <section className="bg-white border border-gray-200 p-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [MEMORY GROWTH]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.memoryGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxis}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="New Memories"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Search Activity */}
          <section className="bg-white border border-gray-200 p-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [SEARCH ACTIVITY]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.searchActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxis}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Searches"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Token Usage */}
          <section className="bg-white border border-gray-200 p-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [TOKEN USAGE]
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.tokenUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxis}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Tokens"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Top Users */}
        <section className="mt-6">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [TOP USERS BY ACTIVITY]
          </div>
          <div className="bg-white border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-mono text-gray-500 uppercase tracking-wider">
                    Memories
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-mono text-gray-500 uppercase tracking-wider">
                    Searches
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, i) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-400 w-4">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-900">
                          {user.email || 'No email'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-900">
                      {user.memoryCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-900">
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
