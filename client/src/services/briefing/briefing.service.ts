import type {
  Briefing,
  BriefingType,
  NotificationPreferences,
} from "../../types/briefing"
import { requireAuthToken } from "../../utils/auth"
import { getRequest, postRequest, putRequest } from "../../utils/http"

const baseUrl = "/briefings"

export async function listBriefings(options?: {
  type?: BriefingType
  limit?: number
  offset?: number
}): Promise<{ briefings: Briefing[]; total: number }> {
  requireAuthToken()
  const params = new URLSearchParams()
  if (options?.type) params.set("type", options.type)
  if (options?.limit) params.set("limit", String(options.limit))
  if (options?.offset) params.set("offset", String(options.offset))
  const query = params.toString() ? `?${params.toString()}` : ""
  const response = await getRequest(`${baseUrl}${query}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch briefings")
  }
  return response.data.data
}

export async function getLatestBriefings(): Promise<
  Record<BriefingType, Briefing>
> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/latest`)
  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "Failed to fetch latest briefings"
    )
  }
  return response.data.data
}

export async function getBriefing(id: string): Promise<Briefing> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/${id}`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch briefing")
  }
  return response.data.data
}

export async function markAsRead(id: string): Promise<void> {
  requireAuthToken()
  const response = await postRequest(`${baseUrl}/${id}/read`, {})
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to mark briefing as read")
  }
}

export async function getUnreadCount(): Promise<number> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/unread-count`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch unread count")
  }
  return response.data.data.count
}

export async function getPreferences(): Promise<NotificationPreferences> {
  requireAuthToken()
  const response = await getRequest(`${baseUrl}/preferences`)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to fetch preferences")
  }
  return response.data.data
}

export async function updatePreferences(
  data: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  requireAuthToken()
  const response = await putRequest(`${baseUrl}/preferences`, data)
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to update preferences")
  }
  return response.data.data
}

export async function generateNow(): Promise<Briefing | null> {
  requireAuthToken()
  const response = await postRequest(`${baseUrl}/generate`, {})
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to generate briefing")
  }
  return response.data.data
}
