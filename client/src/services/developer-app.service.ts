import { axiosInstance } from '@/utils/http'

export interface DeveloperAppInfo {
  id: string
  developerId: string
  name: string
  description?: string | null
  meshNamespaceId: string
  created_at: string
  updated_at: string
}

export interface CreateDeveloperAppRequest {
  name: string
  description?: string
}

export interface UpdateDeveloperAppRequest {
  name?: string
  description?: string | null
}

export class DeveloperAppService {
  static async createDeveloperApp(data: CreateDeveloperAppRequest): Promise<DeveloperAppInfo> {
    const response = await axiosInstance.post('/v1/dev/apps', data)
    return response.data.data
  }

  static async listDeveloperApps(): Promise<DeveloperAppInfo[]> {
    const response = await axiosInstance.get('/v1/dev/apps')
    return response.data.data || []
  }

  static async getDeveloperApp(id: string): Promise<DeveloperAppInfo> {
    const response = await axiosInstance.get(`/v1/dev/apps/${id}`)
    return response.data.data
  }

  static async updateDeveloperApp(id: string, data: UpdateDeveloperAppRequest): Promise<DeveloperAppInfo> {
    const response = await axiosInstance.patch(`/v1/dev/apps/${id}`, data)
    return response.data.data
  }

  static async deleteDeveloperApp(id: string): Promise<void> {
    await axiosInstance.delete(`/v1/dev/apps/${id}`)
  }

  static async getAppStats(appId: string): Promise<{
    totalMemories: number
    totalApiKeys: number
    activeApiKeys: number
    totalRequests: number
    recentMemories: Array<{
      id: string
      content: string
      created_at: string
      source: string
    }>
  }> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/stats`)
    if (!response || !response.data || !response.data.success) {
      throw new Error("Failed to fetch app stats")
    }
    return response.data.data
  }

  static async getAppMesh(id: string): Promise<{
    nodes: any[]
    edges: any[]
    clusters: Record<string, string[]>
  }> {
    const response = await axiosInstance.get(`/v1/dev/apps/${id}/mesh`)
    return {
      nodes: response.data.data.nodes || [],
      edges: response.data.data.edges || [],
      clusters: response.data.data.clusters || {}
    }
  }
}
