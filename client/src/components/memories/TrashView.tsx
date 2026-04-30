import React, { useEffect, useState } from "react"
import { memoryV2Service, type MemoryV2 } from "@/services/memory-v2.service"
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/shared/PageHeader"

export const TrashView: React.FC = () => {
  const navigate = useNavigate()
  const [memories, setMemories] = useState<MemoryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await memoryV2Service.list({ onlyDeleted: true, limit: 100 })
      setMemories(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trash")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const restore = async (id: string) => {
    setBusy(true)
    try {
      await memoryV2Service.restore(id)
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore")
    } finally {
      setBusy(false)
    }
  }

  const permanentlyDelete = async () => {
    if (!confirmDeleteId) return
    setBusy(true)
    try {
      await memoryV2Service.delete(confirmDeleteId, true)
      setMemories((prev) => prev.filter((m) => m.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader pageName="Trash" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <button
          onClick={() => navigate("/memories")}
          className="text-xs font-mono text-gray-600 hover:text-black inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to memories
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Trash</h1>
          <span className="text-xs font-mono text-gray-500">
            {memories.length} item{memories.length === 1 ? "" : "s"}
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Deleted memories live here for 30 days. Restore them, or remove them
          permanently.
        </p>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500 italic border border-dashed border-gray-300 rounded">
            Trash is empty.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
            {memories.map((m) => (
              <li
                key={m.id}
                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {m.title || "Untitled memory"}
                  </div>
                  {m.deleted_at && (
                    <div className="text-xs text-gray-500 font-mono">
                      Deleted {new Date(m.deleted_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore(m.id)}
                  disabled={busy}
                  data-testid={`restore-${m.id}`}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmDeleteId(m.id)}
                  disabled={busy}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete forever
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Permanently delete?"
        message="This action cannot be undone. The memory will be removed forever."
        confirmLabel={busy ? "Deleting..." : "Delete forever"}
        onConfirm={permanentlyDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

export default TrashView
