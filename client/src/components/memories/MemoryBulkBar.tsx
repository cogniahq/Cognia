import React, { useState } from "react"
import { memoryV2Service } from "@/services/memory-v2.service"
import { FolderInput, Tag as TagIcon, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface MemoryBulkBarProps {
  selectedIds: string[]
  onCleared: () => void
  onTagClick?: () => void
  onMoveClick?: () => void
}

export const MemoryBulkBar: React.FC<MemoryBulkBarProps> = ({
  selectedIds,
  onCleared,
  onTagClick,
  onMoveClick,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const performBulkDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await memoryV2Service.bulkDelete(selectedIds)
      setConfirmOpen(false)
      onCleared()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="text-sm font-mono text-gray-700">
            <strong>{selectedIds.length}</strong> selected
          </div>
          <div className="flex items-center gap-2">
            {onTagClick && (
              <Button variant="outline" size="sm" onClick={onTagClick}>
                <TagIcon className="w-4 h-4 mr-1.5" />
                Tag
              </Button>
            )}
            {onMoveClick && (
              <Button variant="outline" size="sm" onClick={onMoveClick}>
                <FolderInput className="w-4 h-4 mr-1.5" />
                Move
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              data-testid="bulk-delete-button"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={onCleared}>
              Clear
            </Button>
          </div>
        </div>
        {error && (
          <div className="px-4 pb-2 text-xs text-red-600 font-mono">
            {error}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete memories?"
        message={`This moves ${selectedIds.length} memor${
          selectedIds.length === 1 ? "y" : "ies"
        } to Trash. You can restore them within 30 days.`}
        confirmLabel={busy ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        onConfirm={performBulkDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

export default MemoryBulkBar
