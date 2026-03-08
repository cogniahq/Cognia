import { requireAuthToken } from "@/utils/auth"
import { deleteRequest, getRequest, postRequest } from "@/utils/http"

import type {
  MeetingDetail,
  MeetingListResponse,
  StartMeetingInput,
} from "@/types/meeting"

const getApiError = (response: {
  data?: { success?: boolean; error?: string }
}) => response.data?.error || "Request failed"

export async function listMeetings(
  limit: number = 50,
  offset: number = 0
): Promise<MeetingListResponse> {
  requireAuthToken()
  const response = await getRequest(`/meetings?limit=${limit}&offset=${offset}`)

  if (!response?.data || response.data.success === false) {
    throw new Error(getApiError(response))
  }

  return response.data.data
}

export async function getMeeting(meetingId: string): Promise<MeetingDetail> {
  requireAuthToken()
  const response = await getRequest(`/meetings/${meetingId}`)

  if (!response?.data || response.data.success === false) {
    throw new Error(getApiError(response))
  }

  return response.data.data
}

export async function startMeeting(
  input: StartMeetingInput
): Promise<MeetingDetail> {
  requireAuthToken()
  const response = await postRequest("/meetings/join", input)

  if (!response?.data || response.data.success === false) {
    throw new Error(getApiError(response))
  }

  return response.data.data
}

export async function stopMeeting(meetingId: string): Promise<void> {
  requireAuthToken()
  const response = await deleteRequest(`/meetings/${meetingId}/stop`)

  if (!response?.data || response.data.success === false) {
    throw new Error(getApiError(response))
  }
}
