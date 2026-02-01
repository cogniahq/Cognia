import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  render?: (item: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  onRowClick?: (item: T) => void
  isLoading?: boolean
  emptyMessage?: string
  pagination?: {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
  }
}

export function DataTable<T extends { [key: string]: unknown }>({
  columns,
  data,
  keyField,
  onRowClick,
  isLoading,
  emptyMessage = 'No data',
  pagination,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200">
        <div className="p-8 text-center">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Loading...
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200">
        <div className="p-8 text-center">
          <div className="text-xs text-gray-500">{emptyMessage}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase tracking-wider"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={String(item[keyField as string])}
                onClick={() => onRowClick?.(item)}
                className={`
                  border-b border-gray-100 last:border-0
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                `}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
