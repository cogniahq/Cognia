export type MeetingStatus =
  | "JOINING"
  | "IN_MEETING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface MeetingActionItem {
  text: string
  assignee?: string
  dueDate?: string
  priority?: "low" | "medium" | "high"
}

export interface MeetingTopic {
  name: string
  description: string
  startTime: number
  endTime: number
}

export interface MeetingSummary {
  id: string
  meeting_url: string
  platform: string
  status: MeetingStatus
  title?: string | null
  started_at?: string | null
  ended_at?: string | null
  created_at: string
  calendar_event_id?: string | null
}

export interface MeetingDetail extends MeetingSummary {
  user_id: string
  organization_id?: string | null
  bot_session_id?: string | null
  raw_transcript?: TranscriptSegment[] | null
  summary?: string | null
  action_items?: MeetingActionItem[] | null
  topics?: MeetingTopic[] | null
  updated_at: string
}

export interface MeetingListResponse {
  meetings: MeetingSummary[]
  total: number
}

export interface StartMeetingInput {
  meetingUrl: string
  title?: string
  organizationId?: string
}
