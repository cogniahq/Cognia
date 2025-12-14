import { axiosInstance } from '@/utils/http'

export interface ApiKeyInfo {
  id: string
  keyPrefix: string
  lastFour: string
  name: string
  description?: string | null
  rateLimit?: number | null
  rateLimitWindow?: number | null
  expiresAt?: string | null
  isActive: boolean
  lastUsedAt?: string | null
  usageCount: number
  created_at: string
}

export interface CreateApiKeyRequest {
  name: string
  description?: string
  rateLimit?: number
  rateLimitWindow?: number
  expiresAt?: string
}

export interface UpdateApiKeyRequest {
  name?: string
  description?: string | null
  rateLimit?: number | null
  rateLimitWindow?: number | null
  expiresAt?: string | null
}

export interface CreateApiKeyResponse {
  id: string
  api_key: string
  prefix: string
  last_four: string
  created_at: string
}

export class ApiKeyService {
  static async createApiKey(appId: string, data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const response = await axiosInstance.post(`/v1/dev/apps/${appId}/keys`, data)
    return response.data.data
  }

  static async listApiKeys(appId: string): Promise<ApiKeyInfo[]> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/keys`)
    return response.data.data || []
  }

  static async getApiKey(appId: string, keyId: string): Promise<ApiKeyInfo> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/keys/${keyId}`)
    return response.data.data
  }

  static async updateApiKey(appId: string, keyId: string, data: UpdateApiKeyRequest): Promise<ApiKeyInfo> {
    const response = await axiosInstance.patch(`/v1/dev/apps/${appId}/keys/${keyId}`, data)
    return response.data.data
  }

  static async revokeApiKey(appId: string, keyId: string): Promise<void> {
    await axiosInstance.post(`/v1/dev/apps/${appId}/keys/${keyId}/revoke`, {})
  }

  static async getApiKeyUsage(appId: string, keyId: string): Promise<{ usageCount: number; lastUsedAt: string | null }> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/keys/${keyId}/usage`)
    return response.data.data
  }
}

