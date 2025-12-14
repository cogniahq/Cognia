export interface Memory {
  id?: string
  content: string
  metadata?: Record<string, any>
}

export interface QueryResult {
  id: string
  content: string
  metadata?: Record<string, any>
  score: number
}

export interface QueryOptions {
  limit?: number
  filters?: Record<string, any>
}
