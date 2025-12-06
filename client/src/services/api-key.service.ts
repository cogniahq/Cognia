import { requireAuthToken } from '@/utils/auth'
import { getRequest, postRequest, patchRequest, deleteRequest } from '@/utils/http'

export interface ApiKeyInfo {
  id: string
  keyPrefix: string
  name: string
  description?: string | null
  memoryIsolation: boolean
  rateLimit?: number | null
  rateLimitWindow?: number | null
  expiresAt?: string | null
  isActive: boolean
  lastUsedAt?: string | null
  usageCount: number
  created_at: string
  updated_at: string
}

export interface CreateApiKeyRequest {
  name: string
  description?: string
  memoryIsolation?: boolean
  rateLimit?: number
  rateLimitWindow?: number
  expiresAt?: string
}

export interface UpdateApiKeyRequest {
  name?: string
  description?: string | null
  memoryIsolation?: boolean
  rateLimit?: number | null
  rateLimitWindow?: number | null
  expiresAt?: string | null
}

export interface CreateApiKeyResponse {
  key: string
  info: ApiKeyInfo
}

export class ApiKeyService {
  static async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    requireAuthToken()
    const response = await postRequest('/api/api-keys', data)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to create API key')
    }
    return response.data?.data
  }

  static async listApiKeys(): Promise<ApiKeyInfo[]> {
    requireAuthToken()
    const response = await getRequest('/api/api-keys')
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to list API keys')
    }
    return response.data?.data || []
  }

  static async getApiKey(id: string): Promise<ApiKeyInfo> {
    requireAuthToken()
    const response = await getRequest(`/api/api-keys/${id}`)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to get API key')
    }
    return response.data?.data
  }

  static async updateApiKey(id: string, data: UpdateApiKeyRequest): Promise<ApiKeyInfo> {
    requireAuthToken()
    const response = await patchRequest(`/api/api-keys/${id}`, data)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to update API key')
    }
    return response.data?.data
  }

  static async revokeApiKey(id: string): Promise<void> {
    requireAuthToken()
    const response = await deleteRequest(`/api/api-keys/${id}`)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to revoke API key')
    }
  }

  static async getApiKeyUsage(id: string): Promise<{ usageCount: number; lastUsedAt: string | null }> {
    requireAuthToken()
    const response = await getRequest(`/api/api-keys/${id}/usage`)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || 'Failed to get API key usage')
    }
    return response.data?.data
  }
}

