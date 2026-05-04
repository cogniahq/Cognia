import { fetchJSON } from "./memory-v2.service"

// Cognia is org-only; direct user-to-user shares were removed.
export type ShareRecipientType = "link" | "organization"

export interface Share {
  id: string
  memory_id: string
  recipient_type: ShareRecipientType
  recipient_org_id?: string | null
  permission?: "read" | "comment" | "edit" | string
  token?: string | null
  expires_at?: string | null
  created_at?: string
}

export interface CreateShareInput {
  memoryId: string
  recipientType: ShareRecipientType
  recipientOrgId?: string
  permission?: "read" | "comment" | "edit"
  expiresAt?: string
}

export const shareService = {
  list: (memoryId: string) =>
    fetchJSON<{ success: boolean; data: Share[] }>(
      `/api/shares?memoryId=${encodeURIComponent(memoryId)}`
    ),
  create: (input: CreateShareInput) =>
    fetchJSON<{ success: boolean; data: Share }>(`/api/shares`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (shareId: string) =>
    fetchJSON<{ success: boolean }>(`/api/shares/${shareId}`, {
      method: "DELETE",
    }),
  consumeLink: (token: string) =>
    fetchJSON<{
      success: boolean
      data: { memoryId: string } & Record<string, unknown>
    }>(`/api/shares/link/${encodeURIComponent(token)}`),
}
