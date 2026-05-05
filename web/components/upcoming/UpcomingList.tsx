"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { calendarService } from "@/services/calendar.service"
import {
  todosService,
  type MemoryTodo,
  type TodoStatus,
} from "@/services/todos.service"

import { TodoItemCard } from "./TodoItemCard"

interface UpcomingListProps {
  organizationId: string
  /** Initial todos pre-fetched on the server. */
  initialTodos: MemoryTodo[]
  /** Cursor for the next page; null when initialTodos exhausted the list. */
  initialCursor: string | null
  allMembers?: boolean
  initialStatus?: TodoStatus | "ALL"
}

type Bucket = "overdue" | "today" | "week" | "later" | "noDate"

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  noDate: "No date",
}

const BUCKET_ORDER: Bucket[] = ["overdue", "today", "week", "later", "noDate"]

function bucketOf(todo: MemoryTodo, now: Date): Bucket {
  if (!todo.due_at) return "noDate"
  const due = new Date(todo.due_at)
  if (Number.isNaN(due.getTime())) return "noDate"

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  if (due < startOfToday) return "overdue"
  if (due < startOfTomorrow) return "today"
  if (due < endOfWeek) return "week"
  return "later"
}

function groupTodos(
  todos: MemoryTodo[],
  now: Date
): Record<Bucket, MemoryTodo[]> {
  const buckets: Record<Bucket, MemoryTodo[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    noDate: [],
  }
  for (const t of todos) buckets[bucketOf(t, now)].push(t)
  return buckets
}

export function UpcomingList({
  organizationId,
  initialTodos,
  initialCursor,
  allMembers = false,
  initialStatus = "PENDING",
}: UpcomingListProps) {
  const [todos, setTodos] = useState<MemoryTodo[]>(initialTodos)
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<TodoStatus | "ALL">(initialStatus)
  const [calendarConnected, setCalendarConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    calendarService
      .status()
      .then((res) => {
        if (!cancelled) setCalendarConnected(res.data.connected)
      })
      .catch(() => {
        if (!cancelled) setCalendarConnected(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(
    async (cursor?: string) => {
      const setBusy = cursor ? setLoadingMore : setLoading
      setBusy(true)
      setError(null)
      try {
        const params = {
          organizationId,
          allMembers,
          cursor,
          ...(status !== "ALL" ? { status: status as TodoStatus } : {}),
        }
        const res = await todosService.list(params)
        setTodos((prev) => (cursor ? [...prev, ...res.data] : res.data))
        setNextCursor(res.nextCursor)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load todos")
      } finally {
        setBusy(false)
      }
    },
    [organizationId, allMembers, status]
  )

  // Re-fetch from page 1 when the status filter changes; the SSR'd initial
  // page is for the default PENDING filter.
  const initialStatusRef = useState(initialStatus)[0]
  useEffect(() => {
    if (status !== initialStatusRef) {
      load()
    }
  }, [status, load, initialStatusRef])

  const updateOne = useCallback((next: MemoryTodo) => {
    setTodos((prev) => prev.map((t) => (t.id === next.id ? next : t)))
  }, [])
  const removeOne = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const requestCalendarConnect = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/integrations"
    }
  }, [])

  const buckets = groupTodos(todos, new Date())

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs font-mono text-gray-600">
        <span>Filter:</span>
        {(["PENDING", "DONE", "DISMISSED", "ALL"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-2 py-1 rounded uppercase tracking-wide ${
              status === s
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => load()}
          disabled={loading}
          className="ml-auto px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 border border-red-200 rounded bg-red-50 text-xs text-red-700 font-mono">
          {error}
        </div>
      )}

      {loading && todos.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500 text-xs font-mono gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading upcoming items...
        </div>
      ) : todos.length === 0 ? (
        <div className="border border-gray-200 rounded-xl py-12 text-center text-xs font-mono text-gray-500">
          No upcoming items extracted yet. New items appear automatically as you
          capture more memories.
        </div>
      ) : (
        BUCKET_ORDER.map((b) => {
          const items = buckets[b]
          if (items.length === 0) return null
          return (
            <section key={b} className="space-y-1">
              <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.18em] px-1">
                {BUCKET_LABELS[b]} · {items.length}
              </h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {items.map((t) => (
                  <TodoItemCard
                    key={t.id}
                    todo={t}
                    showOwner={allMembers}
                    calendarConnected={calendarConnected}
                    onChange={updateOne}
                    onRemove={removeOne}
                    onCalendarConnectRequested={requestCalendarConnect}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => load(nextCursor)}
            disabled={loadingMore}
            className="px-4 py-2 text-xs font-mono text-gray-700 border border-gray-300 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
