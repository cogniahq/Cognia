import { useState } from "react"
import { todosService, type MemoryTodo } from "@/services/todos.service"
import {
  Calendar,
  CalendarPlus,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

interface TodoItemCardProps {
  todo: MemoryTodo
  /** Show the assignee email when present (for the org-admin all-members view). */
  showOwner?: boolean
  ownerEmail?: string | null
  calendarConnected: boolean
  onChange: (next: MemoryTodo) => void
  onRemove: (id: string) => void
  /** Triggered when the row's "Add to Calendar" button is clicked but
   * the user isn't connected yet. Parent typically scrolls to / opens
   * the connect CTA. */
  onCalendarConnectRequested: () => void
}

function formatDueAt(iso: string | null): string {
  if (!iso) return "No date"
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function dueIsoForInput(iso: string | null): string {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    // datetime-local wants local-tz formatted "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

export function TodoItemCard({
  todo,
  showOwner = false,
  ownerEmail,
  calendarConnected,
  onChange,
  onRemove,
  onCalendarConnectRequested,
}: TodoItemCardProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [dueAt, setDueAt] = useState(dueIsoForInput(todo.due_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarToast, setCalendarToast] = useState<{
    href: string
    label: string
  } | null>(null)

  const isDone = todo.status === "DONE"
  const isPushed = !!todo.calendar_event_id

  const toggleDone = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = isDone ? "PENDING" : "DONE"
      const res = await todosService.update(todo.id, { status: next })
      onChange(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setBusy(false)
    }
  }

  const dismiss = async () => {
    setBusy(true)
    setError(null)
    try {
      await todosService.remove(todo.id)
      onRemove(todo.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed")
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await todosService.update(todo.id, {
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      })
      onChange(res.data)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  const addToCalendar = async () => {
    if (!calendarConnected) {
      onCalendarConnectRequested()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await todosService.addToCalendar(todo.id, {
        duration_minutes: 30,
      })
      onChange(res.data.todo)
      setCalendarToast({ href: res.data.html_link, label: "Open event" })
      window.setTimeout(() => setCalendarToast(null), 6000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed"
      // Backend returns CALENDAR_NOT_CONNECTED if the user disconnected
      // mid-session — bounce to reconnect.
      if (msg.toLowerCase().includes("connect google calendar")) {
        onCalendarConnectRequested()
      }
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 ${
        isDone ? "bg-gray-50/60" : "bg-white"
      }`}
    >
      <button
        type="button"
        onClick={toggleDone}
        disabled={busy}
        aria-label={isDone ? "Mark as pending" : "Mark as done"}
        className={`mt-0.5 flex-none w-4 h-4 rounded border ${
          isDone
            ? "bg-gray-900 border-gray-900 text-white"
            : "bg-white border-gray-300 hover:border-gray-500"
        } flex items-center justify-center`}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy || !title.trim()}
                className="px-2 py-1 text-xs font-mono text-white bg-gray-900 hover:bg-gray-700 rounded disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setTitle(todo.title)
                  setDueAt(dueIsoForInput(todo.due_at))
                }}
                disabled={busy}
                className="px-2 py-1 text-xs font-mono text-gray-600 hover:text-gray-900 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`text-sm ${isDone ? "text-gray-400 line-through" : "text-gray-900"}`}
            >
              {todo.title}
            </div>
            <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] font-mono text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDueAt(todo.due_at)}
              </span>
              {todo.memory?.url && (
                <a
                  href={todo.memory.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  <ExternalLink className="w-3 h-3" />
                  {todo.memory.title || "Source"}
                </a>
              )}
              {showOwner && ownerEmail && (
                <span className="text-gray-400">{ownerEmail}</span>
              )}
              {isPushed && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CalendarPlus className="w-3 h-3" />
                  On calendar
                </span>
              )}
            </div>
            {todo.description && (
              <p className="mt-1 text-xs text-gray-600 truncate">
                {todo.description}
              </p>
            )}
            {error && (
              <p className="mt-1 text-xs text-red-700 font-mono">{error}</p>
            )}
            {calendarToast && (
              <p className="mt-1 text-xs text-emerald-700 font-mono">
                Added to calendar.{" "}
                <a
                  href={calendarToast.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {calendarToast.label}
                </a>
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {!editing && todo.status === "PENDING" && !isPushed && (
          <button
            type="button"
            onClick={addToCalendar}
            disabled={busy}
            title="Add to Google Calendar"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            title="Edit"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            title="Dismiss"
            className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Close editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default TodoItemCard
