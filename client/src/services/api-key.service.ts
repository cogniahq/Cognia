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
    return (response.data.data || []).map(this.mapToApiKeyInfo)
  }

  static async getApiKey(appId: string, keyId: string): Promise<ApiKeyInfo> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/keys/${keyId}`)
    return this.mapToApiKeyInfo(response.data.data)
  }

  static async updateApiKey(appId: string, keyId: string, data: UpdateApiKeyRequest): Promise<ApiKeyInfo> {
    const response = await axiosInstance.patch(`/v1/dev/apps/${appId}/keys/${keyId}`, data)
    return this.mapToApiKeyInfo(response.data.data)
  }

  static async revokeApiKey(appId: string, keyId: string): Promise<void> {
    await axiosInstance.post(`/v1/dev/apps/${appId}/keys/${keyId}/revoke`, {})
  }

  static async getApiKeyUsage(appId: string, keyId: string): Promise<{ usageCount: number; lastUsedAt: string | null }> {
    const response = await axiosInstance.get(`/v1/dev/apps/${appId}/keys/${keyId}/usage`)
    // Usage endpoint returns camelCase or snake_case? Controller says: usageCount, lastUsedAt (lines 249-250)
    // So usage endpoint is actually camelCase in controller! (Wait, let me double check controller line 246)
    return response.data.data
  }

  private static mapToApiKeyInfo(data: any): ApiKeyInfo {
    return {
      id: data.id,
      keyPrefix: data.prefix, // Controller returns 'prefix' (line 78)
      lastFour: data.last_four,
      name: data.name,
      description: data.description,
      rateLimit: data.rate_limit,
      rateLimitWindow: data.rate_limit_window,
      expiresAt: data.expires_at,
      isActive: data.is_active,
      lastUsedAt: data.last_used_at,
      usageCount: data.usage_count,
      created_at: data.created_at,
    }
  }
}

