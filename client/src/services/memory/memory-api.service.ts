import type { Memory } from "../../types/memory"
import { requireAuthToken } from "../../utils/auth"
import { getRequest } from "../../utils/http"
import { transformApiMemoryResponse } from "../../utils/transform"

interface ApiMemoryResponse {
  id?: string
  hash?: string
  timestamp: string | number
  created_at?: string
  title?: string
  content?: string
  source?: string
  url?: string
  page_metadata?: Record<string, unknown>
  access_count?: number
  last_accessed?: string
}

const baseUrl = "/memory"

function withOrg(qs: string, organizationId?: string | null): string {
  if (!organizationId) return qs
  const sep = qs.includes("?") ? "&" : "?"
  return `${qs}${sep}organizationId=${encodeURIComponent(organizationId)}`
}

export async function getMemoriesWithTransactionDetails(
  limit?: number,
  organizationId?: string | null
): Promise<Memory[]> {
  requireAuthToken()

  try {
    const response = await getRequest(
      withOrg(`${baseUrl}/user/recent?count=${limit || 10000}`, organizationId)
    )

    if (response.data?.success === false) {
      console.error("API error:", response.data?.error)
      throw new Error(response.data?.error || "API returned error")
    }

    const data = response.data?.data
    const memories = data?.memories || []

    if (Array.isArray(memories)) {
      if (memories.length === 0) {
        console.log("No memories found")
        return []
      }

      return memories.map((mem: ApiMemoryResponse) =>
        transformApiMemoryResponse(mem)
      )
    }

    console.log("No memories found in response:", response.data)
  } catch (error) {
    console.error("Error fetching memories:", error)
    throw error
  }

  return []
}

export async function getRecentMemories(
  count: number = 10,
  organizationId?: string | null
): Promise<Memory[]> {
  requireAuthToken()

  try {
    const response = await getRequest(
      withOrg(`${baseUrl}/user/recent?count=${count}`, organizationId)
    )
    const data = response.data?.data

    if (Array.isArray(data?.memories) && data.memories.length > 0) {
      return data.memories.map((mem: ApiMemoryResponse) => {
        const transformed = transformApiMemoryResponse(mem)
        return {
          ...transformed,
          hash: mem.hash || transformed.hash,
        }
      })
    }
  } catch (error) {
    // Error fetching recent memories from API
  }

  return []
}

export async function getUserMemories(
  page: number = 1,
  limit: number = 20
): Promise<{ memories: Memory[]; total: number; page: number; limit: number }> {
  requireAuthToken()
  const response = await getRequest(
    `${baseUrl}/user?page=${page}&limit=${limit}`
  )
  const data = response.data?.data
  return data || { memories: [], total: 0, page, limit }
}

export async function getUserMemoryCount(
  organizationId?: string | null
): Promise<number> {
  requireAuthToken()
  try {
    const response = await getRequest(
      withOrg(`${baseUrl}/user/count`, organizationId)
    )
    const count = response.data?.data?.memoryCount
    return typeof count === "number" ? count : parseInt(count) || 0
  } catch (error) {
    console.error("Error fetching memory count:", error)
    return 0
  }
}

export async function getMemoryByHash(hash: string): Promise<Memory | null> {
  const response = await getRequest(`${baseUrl}/hash/${hash}`)
  return response.data?.data || null
}

export async function isMemoryStored(hash: string): Promise<boolean> {
  const response = await getRequest(`${baseUrl}/exists/${hash}`)
  return response.data?.data?.exists || false
}

export async function deleteMemory(memoryId: string): Promise<void> {
  requireAuthToken()
  const { deleteRequest } = await import("../../utils/http")
  await deleteRequest(`${baseUrl}/${memoryId}`)
}

export async function healthCheck(): Promise<{
  status: string
  timestamp: string
}> {
  const response = await getRequest(`${baseUrl}/health`)
  return (
    response.data?.data || {
      status: "unknown",
      timestamp: new Date().toISOString(),
    }
  )
}
