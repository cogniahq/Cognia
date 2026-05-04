import * as MemoryApi from "./memory/memory-api.service"
import * as MemoryJobs from "./memory/memory-jobs.service"
import * as MemoryMesh from "./memory/memory-mesh.service"
import * as MemorySearch from "./memory/memory-search.service"

export class MemoryService {
  static async getMemoriesWithTransactionDetails(
    limit?: number,
    organizationId?: string | null
  ) {
    return MemoryApi.getMemoriesWithTransactionDetails(limit, organizationId)
  }

  static async getMemoryMesh(limit: number = 50, threshold: number = 0.3) {
    return MemoryMesh.getMemoryMesh(limit, threshold)
  }

  static async searchMemories(
    query: string,
    filters = {},
    page: number = 1,
    limit: number = 10,
    signal?: AbortSignal,
    policy?: string,
    embeddingOnly: boolean = false,
    organizationId?: string | null
  ) {
    return MemorySearch.searchMemories(
      query,
      filters,
      page,
      limit,
      signal,
      policy,
      embeddingOnly,
      organizationId
    )
  }

  static async searchMemoriesHybrid(
    query: string,
    filters = {},
    page: number = 1,
    limit: number = 10,
    organizationId?: string | null
  ) {
    return MemorySearch.searchMemoriesHybrid(
      query,
      filters,
      page,
      limit,
      organizationId
    )
  }

  static async getRecentMemories(
    count: number = 10,
    organizationId?: string | null
  ) {
    return MemoryApi.getRecentMemories(count, organizationId)
  }

  static async getUserMemories(page: number = 1, limit: number = 20) {
    return MemoryApi.getUserMemories(page, limit)
  }

  static async getMemoryWithRelations(memoryId: string) {
    return MemoryMesh.getMemoryWithRelations(memoryId)
  }

  static async getMemoryCluster(memoryId: string, depth: number = 2) {
    return MemoryMesh.getMemoryCluster(memoryId, depth)
  }

  static async getUserMemoryCount(organizationId?: string | null) {
    return MemoryApi.getUserMemoryCount(organizationId)
  }

  static async getMemoryByHash(hash: string) {
    return MemoryApi.getMemoryByHash(hash)
  }

  static async isMemoryStored(hash: string) {
    return MemoryApi.isMemoryStored(hash)
  }

  static async processMemoryForMesh(memoryId: string) {
    return MemoryMesh.processMemoryForMesh(memoryId)
  }

  static async getMemorySnapshots(page: number = 1, limit: number = 20) {
    return MemoryJobs.getMemorySnapshots(page, limit)
  }

  static async healthCheck() {
    return MemoryApi.healthCheck()
  }

  static async deleteMemory(memoryId: string) {
    return MemoryApi.deleteMemory(memoryId)
  }
}
