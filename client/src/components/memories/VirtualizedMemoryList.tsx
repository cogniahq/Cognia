import React, { useRef } from "react"
import type { MemoryV2 } from "@/services/memory-v2.service"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Pencil, Share2, Trash2 } from "lucide-react"

interface VirtualizedMemoryListProps {
  memories: MemoryV2[]
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onEdit?: (m: MemoryV2) => void
  onShare?: (m: MemoryV2) => void
  onDelete?: (m: MemoryV2) => void
  onOpen?: (m: MemoryV2) => void
  estimateSize?: number
  height?: number | string
}

/**
 * Virtualized list of memory rows. Uses @tanstack/react-virtual to render
 * only what's visible. If virtualization is unavailable, falls back to a
 * regular list.
 */
export const VirtualizedMemoryList: React.FC<VirtualizedMemoryListProps> = ({
  memories,
  selectedIds,
  onToggleSelect,
  onEdit,
  onShare,
  onDelete,
  onOpen,
  estimateSize = 64,
  height = 600,
}) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizationAvailable = typeof useVirtualizer === "function"

  const virtualizer = useVirtualizer({
    count: memories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  })

  const renderRow = (m: MemoryV2) => {
    const checked = selectedIds?.has(m.id) ?? false
    return (
      <div
        key={m.id}
        className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 hover:bg-gray-50"
        data-testid={`memory-row-${m.id}`}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleSelect(m.id)}
            aria-label={`Select ${m.title || "memory"}`}
            className="w-4 h-4 cursor-pointer"
          />
        )}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => onOpen?.(m)}
        >
          <div className="text-sm font-medium text-gray-900 truncate">
            {m.title || "Untitled memory"}
          </div>
          {m.content && (
            <div className="text-xs text-gray-500 truncate">{m.content}</div>
          )}
        </button>
        {m.tags && m.tags.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {m.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 rounded"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(m)}
              className="p-1.5 hover:bg-gray-100 rounded"
              aria-label="Edit memory"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {onShare && (
            <button
              onClick={() => onShare(m)}
              className="p-1.5 hover:bg-gray-100 rounded"
              aria-label="Share memory"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(m)}
              className="p-1.5 hover:bg-red-50 rounded"
              aria-label="Delete memory"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!virtualizationAvailable) {
    // Fallback: plain list when @tanstack/react-virtual is unavailable.
    return (
      <div
        ref={parentRef}
        className="overflow-auto border border-gray-200 rounded"
        style={{ height }}
      >
        {memories.map(renderRow)}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto border border-gray-200 rounded"
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const m = memories[vi.index]
          if (!m) return null
          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderRow(m)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VirtualizedMemoryList
