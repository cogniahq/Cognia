import { fetchJSON } from "./memory-v2.service"

export interface Comment {
  id: string
  memory_id: string
  user_id: string
  body: string
  parent_id?: string | null
  created_at: string
  updated_at?: string
  author_name?: string | null
  author_email?: string | null
}

export const commentService = {
  list: (memoryId: string) =>
    fetchJSON<{ success: boolean; data: Comment[] }>(
      `/api/comments?memoryId=${encodeURIComponent(memoryId)}`
    ),
  create: (input: { memoryId: string; body: string; parentId?: string }) =>
    fetchJSON<{ success: boolean; data: Comment }>(`/api/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, body: string) =>
    fetchJSON<{ success: boolean; data: Comment }>(`/api/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),
  remove: (id: string) =>
    fetchJSON<{ success: boolean }>(`/api/comments/${id}`, {
      method: "DELETE",
    }),
}
