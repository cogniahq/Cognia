import type { Memory, QueryResult, QueryOptions } from './types'

export interface MemoryMeshClientConfig {
  apiKey: string
  baseUrl?: string
}

export class MemoryMeshClient {
  private apiKey: string
  private baseUrl: string

  constructor(config: MemoryMeshClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.example.com'
  }

  async addMemories(memories: Memory[]): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/mesh/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ memories }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.stored_ids || []
  }

  async queryMemories(query: string, options?: QueryOptions): Promise<QueryResult[]> {
    const limit = options?.limit || 10
    const filters = options?.filters

    const url = new URL(`${this.baseUrl}/api/v1/mesh/memories/query`)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', limit.toString())
    if (filters) {
      url.searchParams.set('filters', JSON.stringify(filters))
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.hits || []
  }
}

export { Memory, QueryResult, QueryOptions }
