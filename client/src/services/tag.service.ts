import { fetchJSON } from "./memory-v2.service"

export interface Tag {
  id: string
  name: string
  color?: string | null
  created_at?: string
}

export const tagService = {
  list: () => fetchJSON<{ success: boolean; data: Tag[] }>(`/api/tags`),
  create: (input: { name: string; color?: string }) =>
    fetchJSON<{ success: boolean; data: Tag }>(`/api/tags`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (tagId: string) =>
    fetchJSON<{ success: boolean }>(`/api/tags/${tagId}`, {
      method: "DELETE",
    }),
  attach: (tagId: string, memoryId: string) =>
    fetchJSON<{ success: boolean }>(`/api/tags/${tagId}/attach`, {
      method: "POST",
      body: JSON.stringify({ memoryId }),
    }),
  detach: (tagId: string, memoryId: string) =>
    fetchJSON<{ success: boolean }>(`/api/tags/${tagId}/detach`, {
      method: "POST",
      body: JSON.stringify({ memoryId }),
    }),
}
