"use client"

import { fetchJSON } from "./memory-v2.service"

export interface CalendarStatus {
  connected: boolean
  configured: boolean
}

export const calendarService = {
  status: () =>
    fetchJSON<{ success: boolean; data: CalendarStatus }>(
      `/api/calendar/status`
    ),
  authUrl: () =>
    fetchJSON<{ success: boolean; data: { url: string } }>(
      `/api/calendar/auth/url`
    ),
  disconnect: () =>
    fetchJSON<{ success: boolean }>(`/api/calendar/disconnect`, {
      method: "DELETE",
    }),
}
