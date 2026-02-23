export type BriefingType =
  | "DAILY_DIGEST"
  | "WEEKLY_SYNTHESIS"
  | "TREND_ALERT"
  | "TEAM_REPORT"

export interface TopicItem {
  topic: string
  memoryCount: number
  trend: "rising" | "stable" | "new" | "declining"
}

export interface KnowledgeGap {
  topic: string
  suggestion: string
  reason: string
}

export interface Connection {
  memoryA: string
  memoryB: string
  insight: string
}

export interface ExpertUpdate {
  userId: string
  name: string
  topics: string[]
  newMemories: number
}

export interface Briefing {
  id: string
  user_id: string
  organization_id?: string | null
  briefing_type: BriefingType
  period_start: string
  period_end: string
  summary: string
  topics: TopicItem[]
  wow_facts: string[] | null
  knowledge_gaps: KnowledgeGap[] | null
  connections: Connection[] | null
  expert_updates: ExpertUpdate[] | null
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  daily_digest: boolean
  weekly_synthesis: boolean
  trend_alerts: boolean
  team_reports: boolean
  digest_hour: number
  timezone: string
}
