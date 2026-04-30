import React, { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { commentService, type Comment } from "@/services/comment.service"

import { Button } from "@/components/ui/button"

interface MemoryCommentThreadProps {
  memoryId: string
}

export const MemoryCommentThread: React.FC<MemoryCommentThreadProps> = ({
  memoryId,
}) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState("")

  const reload = async () => {
    setLoading(true)
    try {
      const res = await commentService.list(memoryId)
      setComments(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryId])

  const post = async () => {
    if (!draft.trim()) return
    setBusy(true)
    setError(null)
    try {
      await commentService.create({ memoryId, body: draft.trim() })
      setDraft("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post")
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (c: Comment) => {
    setEditingId(c.id)
    setEditingDraft(c.body)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setBusy(true)
    try {
      await commentService.update(editingId, editingDraft.trim())
      setEditingId(null)
      setEditingDraft("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await commentService.remove(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setBusy(false)
    }
  }

  const ownUserId = (user as { id?: string } | null)?.id

  return (
    <section
      aria-label="Comments"
      className="border-t border-gray-200 mt-6 pt-4 space-y-3"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
        Comments
      </h3>

      {loading ? (
        <div className="text-xs text-gray-500">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-gray-500 italic">No comments yet.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const isOwn = ownUserId && c.user_id === ownUserId
            const isEditing = editingId === c.id
            return (
              <li key={c.id} className="border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-700">
                    {c.author_name || c.author_email || c.user_id}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full min-h-[60px] p-2 border border-gray-300 rounded text-sm"
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={busy}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap text-gray-900">
                      {c.body}
                    </p>
                    {isOwn && (
                      <div className="mt-2 flex gap-2">
                        <button
                          className="text-xs text-gray-600 hover:text-black"
                          onClick={() => startEdit(c)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => remove(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2">
        <textarea
          className="w-full min-h-[80px] p-2 border border-gray-300 rounded text-sm"
          placeholder="Add a comment..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="New comment"
        />
        <div className="flex justify-end">
          <Button onClick={post} disabled={busy || !draft.trim()}>
            {busy ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>

      {error && <div className="text-xs text-red-600 font-mono">{error}</div>}
    </section>
  )
}

export default MemoryCommentThread
