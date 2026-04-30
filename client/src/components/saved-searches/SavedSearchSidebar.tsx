import React, { useEffect, useState } from "react"
import {
  savedSearchService,
  type SavedSearch,
} from "@/services/saved-search.service"
import { Bookmark, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SavedSearchSidebarProps {
  /**
   * Called when the user clicks a saved search row. Receives the full search
   * record so the parent can apply both query and filters.
   */
  onSelect?: (search: SavedSearch) => void
  /**
   * Current search query — exposed to the sidebar so the "Save current search"
   * shortcut can pre-fill it.
   */
  currentQuery?: string
  /**
   * Current filters — saved alongside the query.
   */
  currentFilters?: Record<string, unknown>
  className?: string
}

/**
 * Lightweight saved-searches sidebar. Lists, creates, and deletes saved
 * searches via the existing service module.
 */
export const SavedSearchSidebar: React.FC<SavedSearchSidebarProps> = ({
  onSelect,
  currentQuery = "",
  currentFilters,
  className,
}) => {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [query, setQuery] = useState(currentQuery)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await savedSearchService.list()
      setSearches(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load searches")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    // When the parent's current query changes, keep the form input in sync
    // until the user manually edits it.
    if (!showForm) setQuery(currentQuery)
  }, [currentQuery, showForm])

  const openForm = () => {
    setName("")
    setQuery(currentQuery)
    setAlertEnabled(false)
    setShowForm(true)
  }

  const handleCreate = async () => {
    if (!name.trim() || !query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const filters = {
        ...(currentFilters || {}),
        alertEnabled,
      }
      await savedSearchService.create({
        name: name.trim(),
        query: query.trim(),
        filters,
      })
      setShowForm(false)
      setName("")
      setQuery("")
      setAlertEnabled(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save search")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await savedSearchService.remove(id)
      setSearches((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete search")
    }
  }

  return (
    <Card className={className} data-testid="saved-search-sidebar">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4" />
          Saved searches
        </CardTitle>
        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={openForm}
            data-testid="open-save-search-form"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="space-y-2 border border-gray-200 rounded p-3 bg-gray-50">
            <div className="space-y-1">
              <Label htmlFor="saved-search-name" className="text-xs">
                Name
              </Label>
              <Input
                id="saved-search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My weekly review"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="saved-search-query" className="text-xs">
                Query
              </Label>
              <Input
                id="saved-search-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search terms"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={alertEnabled}
                onChange={(e) => setAlertEnabled(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Alert me when new memories match
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={busy || !name.trim() || !query.trim()}
                data-testid="submit-save-search"
              >
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-600 font-mono">{error}</div>}

        {loading ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : searches.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            No saved searches yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
            {searches.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-gray-50"
              >
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onSelect?.(s)}
                  data-testid={`saved-search-${s.id}`}
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {s.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate font-mono">
                    {s.query}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1 hover:bg-red-50 text-red-600 rounded"
                  aria-label={`Delete saved search ${s.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default SavedSearchSidebar
