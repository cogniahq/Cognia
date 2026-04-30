export type QueryClass = 'recall' | 'search' | 'plan' | 'profile' | 'metric'

export interface QueryClassification {
  class: QueryClass
  confidence: number
  suggestedPolicy?: string
  reasoning?: string
}

export type SearchJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface SearchJob {
  id: string
  user_id?: string
  query?: string
  status: SearchJobStatus
  results?: Array<{
    memory_id: string
    title: string | null
    url: string | null
    score: number
  }>
  answer?: string
  citations?: Array<{
    label: number
    memory_id: string
    title: string | null
    url: string | null
    source_type?: string | null
    author_email?: string | null
    captured_at?: string | null
  }>
  created_at: Date | number
  updated_at?: Date
  expires_at?: number
}

export type SearchResult = {
  memory_id: string
  title: string | null
  content_preview: string | null
  url: string | null
  timestamp: number
  related_memories: string[]
  score: number
  memory_type: string | null
  importance_score: number | null
  source: string | null
}
