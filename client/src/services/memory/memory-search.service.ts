import type { MemorySearchResponse, SearchFilters } from "../../types/memory"
import { requireAuthToken } from "../../utils/auth"
import { getRequest, postRequest } from "../../utils/http"
import { transformApiSearchResult } from "../../utils/transform"

const baseUrl = "/memory"

export async function searchMemories(
  query: string,
  filters: SearchFilters = {},
  page: number = 1,
  limit: number = 10,
  signal?: AbortSignal,
  policy?: string,
  embeddingOnly: boolean = false,
  organizationId?: string | null
): Promise<MemorySearchResponse> {
  try {
    requireAuthToken()

    const response = await postRequest(
      "/search",
      {
        query,
        limit,
        contextOnly: false,
        policy,
        embeddingOnly,
        ...(organizationId ? { organizationId } : {}),
      },
      undefined,
      signal
    )

    if (!response) {
      throw new Error("No response received from server")
    }

    if (response.status >= 400) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`)
    }

    const responseData = response?.data
    if (responseData) {
      const transformedResults = (responseData.results || []).map(
        transformApiSearchResult
      )

      return {
        results: transformedResults,
        total: responseData.results?.length || 0,
        page,
        limit,
        filters,
        answer: responseData.answer,
        citations: responseData.citations,
        job_id: responseData.job_id,
        context: responseData.context,
        contextBlocks: responseData.contextBlocks,
        policy: responseData.policy,
      }
    }
    return { results: [], total: 0, page, limit, filters }
  } catch (error) {
    return { results: [], total: 0, page, limit, filters }
  }
}

export async function searchMemoriesHybrid(
  query: string,
  filters: SearchFilters = {},
  page: number = 1,
  limit: number = 10,
  organizationId?: string | null
): Promise<MemorySearchResponse> {
  try {
    requireAuthToken()
    const params = new URLSearchParams({
      query,
      page: page.toString(),
      limit: limit.toString(),
    })
    if (organizationId) params.set("organizationId", organizationId)

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "object") {
          params.append(key, JSON.stringify(value))
        } else {
          params.append(key, value.toString())
        }
      }
    })

    const response = await getRequest(
      `${baseUrl}/search-hybrid?${params.toString()}`
    )

    if (!response) {
      throw new Error("No response received from server")
    }

    if (response.status >= 400) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`)
    }

    const responseData = response?.data
    if (responseData && responseData.data) {
      return {
        results: responseData.data.results || [],
        total: responseData.data.total || 0,
        page,
        limit,
        filters,
      }
    }
    return { results: [], total: 0, page, limit, filters }
  } catch (error) {
    return { results: [], total: 0, page, limit, filters }
  }
}
