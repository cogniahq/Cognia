import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { getAuditLogs, getDashboard } from '@/services/api'
import type {
  AuditLogItem,
  DashboardStats,
  PaginatedResult,
} from '@/types/admin.types'

export function SystemPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [auditLogs, setAuditLogs] =
    useState<PaginatedResult<AuditLogItem> | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [logsPage, setLogsPage] = useState(1)

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const data = await getDashboard()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingLogs(true)
    try {
      const data = await getAuditLogs(logsPage, 20)
      setAuditLogs(data)
    } catch (err) {
      console.error('Failed to load audit logs', err)
    } finally {
      setIsLoadingLogs(false)
    }
  }, [logsPage])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadAuditLogs()
  }, [loadAuditLogs])

  const auditColumns = [
    {
      key: 'created_at',
      label: 'Time',
      width: '140px',
      render: (log: AuditLogItem) => (
        <span className="text-xs font-mono text-gray-500">
          {format(new Date(log.created_at), 'MM-dd HH:mm:ss')}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      width: '180px',
      render: (log: AuditLogItem) => (
        <span className="text-xs">{log.user.email || '-'}</span>
      ),
    },
    {
      key: 'event_type',
      label: 'Event',
      width: '140px',
      render: (log: AuditLogItem) => (
        <Badge variant="default">{log.event_type}</Badge>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (log: AuditLogItem) => (
        <span className="text-xs text-gray-900">{log.action}</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      width: '120px',
      render: (log: AuditLogItem) => (
        <span className="text-xs font-mono text-gray-500">
          {log.ip_address || '-'}
        </span>
      ),
    },
  ]

  return (
    <>
      <Header title="System" subtitle="System health and configuration" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* System Health */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              [SYSTEM HEALTH]
            </div>
            <button
              onClick={loadStats}
              className="p-1 text-gray-500 hover:text-gray-900"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {stats ? (
            <div className="grid grid-cols-4 gap-2">
              <StatusIndicator
                status={stats.system.database}
                label="PostgreSQL"
                detail="Database"
              />
              <StatusIndicator
                status={stats.system.redis}
                label="Redis"
                detail={stats.system.redisMemory || 'Cache'}
              />
              <StatusIndicator
                status={stats.system.qdrant}
                label="Qdrant"
                detail={`${stats.system.qdrantPoints.toLocaleString()} vectors`}
              />
              <StatusIndicator
                status={true}
                label="API Server"
                detail="Running"
              />
            </div>
          ) : (
            <div className="text-xs text-gray-500">Loading...</div>
          )}
        </section>

        {/* Resource Stats */}
        {stats && (
          <section className="mb-8">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
              [RESOURCE STATS]
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Vector Points</div>
                <div className="text-xl font-mono text-gray-900">
                  {stats.system.qdrantPoints.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Redis Memory</div>
                <div className="text-xl font-mono text-gray-900">
                  {stats.system.redisMemory || 'N/A'}
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">
                  Total Documents
                </div>
                <div className="text-xl font-mono text-gray-900">
                  {stats.documents.total.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Failed Docs</div>
                <div
                  className={`text-xl font-mono ${
                    (stats.documents.byStatus['FAILED'] || 0) > 0
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {(stats.documents.byStatus['FAILED'] || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Configuration */}
        <section className="mb-8">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
            [CONFIGURATION]
          </div>
          <div className="bg-white border border-gray-200">
            <div className="flex justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs text-gray-500">Environment</span>
              <span className="text-xs font-mono">{import.meta.env.MODE}</span>
            </div>
            <div className="flex justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs text-gray-500">API URL</span>
              <span className="text-xs font-mono">/api</span>
            </div>
            <div className="flex justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                Admin Portal Version
              </span>
              <span className="text-xs font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-xs text-gray-500">Build Time</span>
              <span className="text-xs font-mono">
                {format(new Date(), 'yyyy-MM-dd HH:mm')}
              </span>
            </div>
          </div>
        </section>

        {/* Audit Logs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              [AUDIT LOGS]
            </div>
            <button
              onClick={loadAuditLogs}
              className="p-1 text-gray-500 hover:text-gray-900"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <DataTable
            columns={auditColumns}
            data={auditLogs?.data || []}
            keyField="id"
            isLoading={isLoadingLogs}
            emptyMessage="No audit logs found"
            pagination={
              auditLogs
                ? {
                    page: auditLogs.page,
                    totalPages: auditLogs.totalPages,
                    total: auditLogs.total,
                    onPageChange: setLogsPage,
                  }
                : undefined
            }
          />
        </section>
      </div>
    </>
  )
}
