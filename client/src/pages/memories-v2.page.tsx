import React, { useCallback, useEffect, useMemo, useState } from "react"
import { memoryV2Service, type MemoryV2 } from "@/services/memory-v2.service"
import type { SavedSearch } from "@/services/saved-search.service"
import { requireAuthToken } from "@/utils/auth"
import { Search, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useHasPermission } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { MemoryBulkBar } from "@/components/memories/MemoryBulkBar"
import { MemoryEditDialog } from "@/components/memories/MemoryEditDialog"
import { MemoryShareDialog } from "@/components/memories/MemoryShareDialog"
import { VirtualizedMemoryList } from "@/components/memories/VirtualizedMemoryList"
import { SavedSearchSidebar } from "@/components/saved-searches/SavedSearchSidebar"
import { PageHeader } from "@/components/shared/PageHeader"

/**
 * Phase 4 Slice D memories list view. Coexists with the legacy mesh-driven
 * /memories page; this one is the curation-focused list with selection,
 * bulk actions, edit/share dialogs, saved searches, and a trash entrypoint.
 */
export const MemoriesV2: React.FC = () => {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(false)
  const [memories, setMemories] = useState<MemoryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [editing, setEditing] = useState<MemoryV2 | null>(null)
  const [sharing, setSharing] = useState<MemoryV2 | null>(null)
  const [deleting, setDeleting] = useState<MemoryV2 | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // Phase 7 RBAC gating: callbacks are only passed when the user holds the
  // matching permission. VirtualizedMemoryList already renders the row
  // buttons conditionally on the presence of these callbacks, so passing
  // `undefined` hides the button.
  const canWriteMemory = useHasPermission("memory.write")
  const canDeleteMemory = useHasPermission("memory.delete")
  const canShareMemory = useHasPermission("memory.share")

  useEffect(() => {
    try {
      requireAuthToken()
      setAuthed(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await memoryV2Service.list({
        limit: 100,
        q: activeQuery || undefined,
      })
      setMemories(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories")
    } finally {
      setLoading(false)
    }
  }, [activeQuery])

  useEffect(() => {
    if (!authed) return
    refresh()
  }, [authed, refresh])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  const handleApplySaved = (s: SavedSearch) => {
    setSearchQuery(s.query)
    setActiveQuery(s.query)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveQuery(searchQuery)
  }

  const handleConfirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await memoryV2Service.delete(deleting.id)
      setMemories((prev) => prev.filter((m) => m.id !== deleting.id))
      setDeleting(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeletingBusy(false)
    }
  }

  if (!authed) return null

  return (
    <div className="min-h-screen bg-white">
      <PageHeader
        pageName="Memories"
        rightActions={
          <button
            onClick={() => navigate("/memories/trash")}
            className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 inline-flex items-center gap-1.5"
            data-testid="trash-link"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Trash
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-4">
            <SavedSearchSidebar
              onSelect={handleApplySaved}
              currentQuery={activeQuery}
            />
          </aside>

          <main className="space-y-4 min-w-0">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
              role="search"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your memories..."
                  className="pl-9"
                  data-testid="memories-search"
                />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>

            {error && (
              <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-sm text-gray-500">Loading memories...</div>
            ) : memories.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500 italic border border-dashed border-gray-300 rounded">
                No memories match the current filter.
              </div>
            ) : (
              <VirtualizedMemoryList
                memories={memories}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onEdit={canWriteMemory ? (m) => setEditing(m) : undefined}
                onShare={canShareMemory ? (m) => setSharing(m) : undefined}
                onDelete={canDeleteMemory ? (m) => setDeleting(m) : undefined}
                height={600}
              />
            )}
          </main>
        </div>
      </div>

      <MemoryBulkBar
        selectedIds={selectedIdsArray}
        onCleared={() => {
          setSelectedIds(new Set())
          refresh()
        }}
      />

      {editing && (
        <MemoryEditDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          memory={editing}
          onSaved={(next) => {
            setMemories((prev) =>
              prev.map((m) => (m.id === next.id ? { ...m, ...next } : m))
            )
            setEditing(null)
          }}
        />
      )}

      {sharing && (
        <MemoryShareDialog
          open={!!sharing}
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
          memoryId={sharing.id}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleting}
        title="Move to trash?"
        message={
          deleting
            ? `"${deleting.title || "Untitled memory"}" will be moved to Trash. You can restore it within 30 days.`
            : ""
        }
        confirmLabel={deletingBusy ? "Deleting..." : "Move to trash"}
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

export default MemoriesV2
