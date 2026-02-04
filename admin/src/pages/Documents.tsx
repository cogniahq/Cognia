import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { FileText, RefreshCw } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { listDocuments, reprocessDocument } from '@/services/api'
import type {
  DocumentListItem,
  DocumentStatus,
  PaginatedResult,
} from '@/types/admin.types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getStatusBadgeVariant(status: DocumentStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'success'
    case 'FAILED':
      return 'error'
    case 'PROCESSING':
      return 'warning'
    default:
      return 'default'
  }
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<PaginatedResult<DocumentListItem> | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('')
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadDocs()
  }, [page, statusFilter])

  async function loadDocs() {
    setIsLoading(true)
    try {
      const data = await listDocuments(page, 20, statusFilter || undefined)
      setDocs(data)
    } catch (err) {
      console.error('Failed to load documents', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReprocess(docId: string) {
    setReprocessingIds((prev) => new Set(prev).add(docId))
    try {
      await reprocessDocument(docId)
      loadDocs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reprocess document')
    } finally {
      setReprocessingIds((prev) => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Document',
      render: (doc: DocumentListItem) => (
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm text-gray-900 truncate max-w-[300px]">
              {doc.original_name}
            </div>
            <div className="text-xs text-gray-500">{doc.mime_type}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'organization',
      label: 'Organization',
      width: '180px',
      render: (doc: DocumentListItem) => (
        <div>
          <div className="text-sm text-gray-900">{doc.organization.name}</div>
          <div className="text-xs text-gray-500 font-mono">
            {doc.organization.slug}
          </div>
        </div>
      ),
    },
    {
      key: 'uploader',
      label: 'Uploader',
      width: '180px',
      render: (doc: DocumentListItem) => (
        <span className="text-xs text-gray-500">
          {doc.uploader.email || '-'}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      width: '100px',
      render: (doc: DocumentListItem) => (
        <span className="text-xs font-mono text-gray-500">
          {formatBytes(doc.file_size)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (doc: DocumentListItem) => (
        <Badge variant={getStatusBadgeVariant(doc.status)}>{doc.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      width: '120px',
      render: (doc: DocumentListItem) => (
        <span className="text-xs text-gray-500">
          {format(new Date(doc.created_at), 'yyyy-MM-dd')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (doc: DocumentListItem) =>
        doc.status === 'FAILED' ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleReprocess(doc.id)
            }}
            disabled={reprocessingIds.has(doc.id)}
            className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-50"
            title="Reprocess"
          >
            <RefreshCw
              className={`w-4 h-4 ${reprocessingIds.has(doc.id) ? 'animate-spin' : ''}`}
            />
          </button>
        ) : null,
    },
  ]

  return (
    <>
      <Header title="Documents" subtitle="All documents across organizations" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DocumentStatus | '')
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 bg-white"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={loadDocs}
            className="px-3 py-2 border border-gray-300 text-sm hover:border-gray-400 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={docs?.data || []}
          keyField="id"
          isLoading={isLoading}
          emptyMessage="No documents found"
          pagination={
            docs
              ? {
                  page: docs.page,
                  totalPages: docs.totalPages,
                  total: docs.total,
                  onPageChange: setPage,
                }
              : undefined
          }
        />

        {/* Failed Documents Note */}
        {docs && docs.data.some((d) => d.status === 'FAILED') && (
          <div className="mt-4 px-3 py-2 bg-yellow-50 border border-yellow-200 text-xs text-yellow-700">
            Failed documents can be reprocessed using the refresh icon.
          </div>
        )}
      </div>
    </>
  )
}
