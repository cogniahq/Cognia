import React, { useEffect, useState } from "react"
import { tagService, type Tag } from "@/services/tag.service"

import { TagBadge } from "./TagBadge"

interface TagPickerProps {
  memoryId?: string
  initialTags?: Array<Pick<Tag, "id" | "name" | "color">>
  onChange?: (tags: Tag[]) => void
}

/**
 * Multi-select autocomplete tag picker. If memoryId is provided, attaches
 * and detaches tags via the tag service. If not, simply manages a local
 * selection and calls onChange.
 */
export const TagPicker: React.FC<TagPickerProps> = ({
  memoryId,
  initialTags = [],
  onChange,
}) => {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<Tag[]>(initialTags as Tag[])
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    tagService
      .list()
      .then((res) => setAllTags(res.data || []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load tags")
      )
  }, [])

  const filtered = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      !selected.find((s) => s.id === t.id)
  )

  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === query.toLowerCase()
  )

  const attachTag = async (tag: Tag) => {
    const next = [...selected, tag]
    setSelected(next)
    onChange?.(next)
    if (memoryId) {
      try {
        await tagService.attach(tag.id, memoryId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to attach tag")
        setSelected(selected)
        onChange?.(selected)
      }
    }
  }

  const detachTag = async (tag: Tag) => {
    const next = selected.filter((s) => s.id !== tag.id)
    setSelected(next)
    onChange?.(next)
    if (memoryId) {
      try {
        await tagService.detach(tag.id, memoryId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to detach tag")
      }
    }
  }

  const createAndAttach = async () => {
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await tagService.create({ name: query.trim() })
      const tag = res.data
      setAllTags((prev) => [...prev, tag])
      await attachTag(tag)
      setQuery("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((t) => (
          <TagBadge
            key={t.id}
            name={t.name}
            color={t.color}
            onRemove={() => detachTag(t)}
          />
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Search or create tags..."
          className="w-full h-9 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black"
          aria-label="Tag search"
        />
        {showDropdown && (filtered.length > 0 || (query && !exactMatch)) && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((t) => (
              <button
                type="button"
                key={t.id}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  attachTag(t)
                  setQuery("")
                }}
              >
                {t.name}
              </button>
            ))}
            {query && !exactMatch && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700 italic border-t border-gray-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={createAndAttach}
                disabled={busy}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      {error && <div className="text-xs text-red-600 font-mono">{error}</div>}
    </div>
  )
}

export default TagPicker
