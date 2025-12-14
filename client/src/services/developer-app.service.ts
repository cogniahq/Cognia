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
}
