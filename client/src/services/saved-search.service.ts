import { fetchJSON } from "./memory-v2.service"

export interface SavedSearch {
  id: string
  name: string
  query: string
  filters?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export const savedSearchService = {
  list: () =>
    fetchJSON<{ success: boolean; data: SavedSearch[] }>(`/api/saved-searches`),
  create: (input: {
    name: string
    query: string
    filters?: Record<string, unknown>
  }) =>
    fetchJSON<{ success: boolean; data: SavedSearch }>(`/api/saved-searches`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (
    id: string,
    patch: { name?: string; query?: string; filters?: Record<string, unknown> }
  ) =>
    fetchJSON<{ success: boolean; data: SavedSearch }>(
      `/api/saved-searches/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    ),
  remove: (id: string) =>
    fetchJSON<{ success: boolean }>(`/api/saved-searches/${id}`, {
      method: "DELETE",
    }),
}
