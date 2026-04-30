import { fetchJSON } from "./memory-v2.service"

export interface Workspace {
  id: string
  org_id: string
  name: string
  parent_id?: string | null
  created_at?: string
}

export const workspaceService = {
  list: (orgSlug: string) =>
    fetchJSON<{ success: boolean; data: Workspace[] }>(
      `/api/organizations/${encodeURIComponent(orgSlug)}/workspaces`
    ),
  create: (orgSlug: string, input: { name: string; parentId?: string }) =>
    fetchJSON<{ success: boolean; data: Workspace }>(
      `/api/organizations/${encodeURIComponent(orgSlug)}/workspaces`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  remove: (orgSlug: string, workspaceId: string) =>
    fetchJSON<{ success: boolean }>(
      `/api/organizations/${encodeURIComponent(orgSlug)}/workspaces/${workspaceId}`,
      { method: "DELETE" }
    ),
  assignMemory: (
    orgSlug: string,
    memoryId: string,
    workspaceId: string | null
  ) =>
    fetchJSON<{ success: boolean }>(
      `/api/organizations/${encodeURIComponent(orgSlug)}/memories/${encodeURIComponent(
        memoryId
      )}/workspace`,
      { method: "PUT", body: JSON.stringify({ workspaceId }) }
    ),
}
