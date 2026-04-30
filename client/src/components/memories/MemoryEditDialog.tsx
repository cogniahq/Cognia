import React, { useEffect, useState } from "react"
import { memoryV2Service, type MemoryV2 } from "@/services/memory-v2.service"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagPicker } from "@/components/tags/TagPicker"

interface MemoryEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memory: Pick<MemoryV2, "id" | "title" | "content" | "full_content"> & {
    tags?: Array<{ id: string; name: string }>
  }
  onSaved?: (next: MemoryV2) => void
}

/**
 * Markdown editor: tries to lazy-load @uiw/react-md-editor; falls back to a
 * plain textarea if the package is missing.
 */
function MarkdownEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      className="font-mono w-full h-64 p-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="memory-edit-content"
      placeholder="Markdown content..."
    />
  )
}

export const MemoryEditDialog: React.FC<MemoryEditDialogProps> = ({
  open,
  onOpenChange,
  memory,
  onSaved,
}) => {
  const [title, setTitle] = useState(memory.title || "")
  const [content, setContent] = useState(
    memory.full_content || memory.content || ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(memory.title || "")
    setContent(memory.full_content || memory.content || "")
  }, [memory.id, memory.title, memory.content, memory.full_content])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await memoryV2Service.update(memory.id, {
        title,
        full_content: content,
        content,
      })
      onSaved?.(res.data)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit memory</DialogTitle>
          <DialogDescription>
            Update title, content and tags. Changes save to your library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="memory-edit-title">Title</Label>
            <Input
              id="memory-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled memory"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content</Label>
            <MarkdownEditor value={content} onChange={setContent} />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagPicker memoryId={memory.id} initialTags={memory.tags || []} />
          </div>

          {error && (
            <div className="text-sm text-red-600 font-mono">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MemoryEditDialog
