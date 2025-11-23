export interface ContextData {
  source: string
  url: string
  title: string
  content_snippet: string
  timestamp: number
  full_content?: string
  meaningful_content?: string
  content_summary?: string
  content_type?: string
  [key: string]: unknown
}

export interface EmailDraftPayload {
  subject?: string
  thread_text: string
  provider?: string
  existing_draft?: string
  participants?: string[]
  metadata?: Record<string, unknown>
  url?: string
  title?: string
}
