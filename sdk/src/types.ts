/**
 * Public types for the Cognia SDK. These mirror the v1 REST shape.
 */

export type SourceType = 'EXTENSION' | 'BROWSER' | 'MANUAL' | 'REASONING' | 'INTEGRATION' | 'DOCUMENT' | 'API'

export type MemoryType =
  | 'LOG_EVENT'
  | 'KNOWLEDGE'
  | 'INSIGHT'
  | 'TASK'
  | 'DOCUMENT_CHUNK'

export interface Memory {
  id: string
  title: string | null
  content: string
  url: string | null
  memory_type: MemoryType
  source: string | null
  source_type: SourceType | null
  created_at: string
}

export interface SearchHitDocument {
  id?: string
  name?: string
  page_number?: number
}

export interface SearchHit {
  id: string
  title?: string | null
  snippet: string
  url?: string | null
  score?: number
  document?: SearchHitDocument
}

export interface SearchResponse {
  data: SearchHit[]
}

export interface ListMemoriesResponse {
  data: Memory[]
  next_cursor: string | null
}

export interface MemoryResponse {
  data: Memory
}

export interface SearchOptions {
  query: string
  limit?: number
}

export interface ListMemoriesOptions {
  cursor?: string | null
  limit?: number
  /** Server-side substring match across title and content. */
  q?: string
}

export interface UpdateMemoryInput {
  title?: string | null
  content?: string
  url?: string | null
  memory_type?: MemoryType
}

export interface CogniaError extends Error {
  status: number
  code: string
  body?: unknown
  requestId?: string | undefined
}
