import { fetchJSON } from "./memory-v2.service"

export type TodoStatus = "PENDING" | "DONE" | "SNOOZED" | "DISMISSED"

export interface MemoryTodo {
  id: string
  memory_id: string
  user_id: string
  organization_id: string
  workspace_id: string | null
  title: string
  description: string | null
  source_excerpt: string | null
  due_at: string | null
  status: TodoStatus
  calendar_event_id: string | null
  calendar_provider: string | null
  snoozed_until: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  memory?: {
    id: string
    title: string | null
    url: string | null
    source: string | null
  }
}

export interface ListTodosParams {
  organizationId: string
  status?: TodoStatus
  dueBefore?: string
  dueAfter?: string
  allMembers?: boolean
  cursor?: string
  limit?: number
}

export interface ListTodosResponse {
  success: boolean
  data: MemoryTodo[]
  nextCursor: string | null
}

function buildQuery(params: ListTodosParams): string {
  const qs = new URLSearchParams()
  qs.set("organizationId", params.organizationId)
  if (params.status) qs.set("status", params.status)
  if (params.dueBefore) qs.set("dueBefore", params.dueBefore)
  if (params.dueAfter) qs.set("dueAfter", params.dueAfter)
  if (params.allMembers) qs.set("allMembers", "true")
  if (params.cursor) qs.set("cursor", params.cursor)
  if (params.limit) qs.set("limit", String(params.limit))
  return qs.toString()
}

export const todosService = {
  list: (params: ListTodosParams) =>
    fetchJSON<ListTodosResponse>(`/api/todos?${buildQuery(params)}`),
  update: (
    id: string,
    patch: Partial<{
      status: TodoStatus
      snoozed_until: string | null
      due_at: string | null
      title: string
      description: string | null
    }>
  ) =>
    fetchJSON<{ success: boolean; data: MemoryTodo }>(`/api/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    fetchJSON<{ success: boolean }>(`/api/todos/${id}`, { method: "DELETE" }),
  addToCalendar: (
    id: string,
    body: {
      duration_minutes?: number
      attendees?: string[]
      description?: string
      time_zone?: string
    } = {}
  ) =>
    fetchJSON<{
      success: boolean
      data: { event_id: string; html_link: string; todo: MemoryTodo }
    }>(`/api/todos/${id}/calendar`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
}
