import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'

const API_KEY_PREFIX = 'ck_'
const API_KEY_LENGTH = 32
const SALT_ROUNDS = 10

export interface CreateApiKeyConfig {
  developerAppId: string
  name: string
  description?: string
  rateLimit?: number
  rateLimitWindow?: number
  expiresAt?: Date
}

export interface ApiKeyInfo {
  id: string
  developerAppId: string
  keyPrefix: string
  lastFour: string
  name: string
  description?: string | null
  rateLimit?: number | null
  rateLimitWindow?: number | null
  expiresAt?: Date | null
  isActive: boolean
  lastUsedAt?: Date | null
  usageCount: number
  created_at: Date
  updated_at: Date
}

export class ApiKeyService {
  generateApiKey(): string {
    const randomPart = randomBytes(API_KEY_LENGTH).toString('base64url')
    return `${API_KEY_PREFIX}${randomPart}`
  }

  async hashApiKey(key: string): Promise<string> {
    return bcrypt.hash(key, SALT_ROUNDS)
  }

  async verifyApiKey(key: string, hash: string): Promise<boolean> {
    return bcrypt.compare(key, hash)
  }

  getKeyPrefix(key: string): string {
    if (!key.startsWith(API_KEY_PREFIX)) {
      throw new Error('Invalid API key format')
    }
    return key.substring(0, API_KEY_PREFIX.length + 8)
  }

  getLastFour(key: string): string {
    if (key.length < 4) {
      return key
    }
    return key.slice(-4)
  }

  async createApiKey(config: CreateApiKeyConfig): Promise<{ key: string; info: ApiKeyInfo }> {
    try {
      const key = this.generateApiKey()
      const keyHash = await this.hashApiKey(key)
      const keyPrefix = this.getKeyPrefix(key)
      const lastFour = this.getLastFour(key)

      const apiKey = await prisma.apiKey.create({
        data: {
          developer_app_id: config.developerAppId,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          last_four: lastFour,
          name: config.name,
          description: config.description,
          rate_limit: config.rateLimit,
          rate_limit_window: config.rateLimitWindow,
          expires_at: config.expiresAt,
          is_active: true,
        },
      })

      return {
        key,
        info: this.mapToApiKeyInfo(apiKey),
      }
    } catch (error) {
      logger.error('Error creating API key:', error)
      throw new AppError('Failed to create API key', 500)
    }
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKeyInfo | null> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          key_hash: keyHash,
          is_active: true,
        },
      })

      if (!apiKey) {
        return null
      }

      if (apiKey.expires_at && apiKey.expires_at < new Date()) {
        return null
      }

      return this.mapToApiKeyInfo(apiKey)
    } catch (error) {
      logger.error('Error getting API key by hash:', error)
      return null
    }
  }

  async findApiKeyByPlainKey(plainKey: string): Promise<{ key: ApiKeyInfo; meshNamespaceId: string } | null> {
    try {
      if (!plainKey.startsWith(API_KEY_PREFIX)) {
        return null
      }

      const keyPrefix = this.getKeyPrefix(plainKey)

      const apiKeys = await prisma.apiKey.findMany({
        where: {
          key_prefix: keyPrefix,
          is_active: true,
        },
        include: {
          developer_app: {
            select: {
              mesh_namespace_id: true,
            },
          },
        },
      })

      for (const apiKey of apiKeys) {
        const isValid = await this.verifyApiKey(plainKey, apiKey.key_hash)
        if (isValid) {
          if (apiKey.expires_at && apiKey.expires_at < new Date()) {
            return null
          }
          return {
            key: this.mapToApiKeyInfo(apiKey),
            meshNamespaceId: apiKey.developer_app.mesh_namespace_id,
          }
        }
      }

      return null
    } catch (error) {
      logger.error('Error finding API key by plain key:', error)
      return null
    }
  }

  async updateApiKeyUsage(keyId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: { id: keyId },
        data: {
          usage_count: { increment: 1 },
          last_used_at: new Date(),
        },
      })
    } catch (error) {
      logger.error('Error updating API key usage:', error)
    }
  }

  async getApiKeysByAppId(developerAppId: string): Promise<ApiKeyInfo[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { developer_app_id: developerAppId },
        orderBy: { created_at: 'desc' },
      })

      return apiKeys.map(key => this.mapToApiKeyInfo(key))
    } catch (error) {
      logger.error('Error getting API keys by app ID:', error)
      throw new AppError('Failed to get API keys', 500)
    }
  }

  async getApiKeyById(keyId: string, developerAppId: string): Promise<ApiKeyInfo | null> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: keyId,
          developer_app_id: developerAppId,
        },
      })

      if (!apiKey) {
        return null
      }

      return this.mapToApiKeyInfo(apiKey)
    } catch (error) {
      logger.error('Error getting API key by ID:', error)
      return null
    }
  }

  async getApiKeyByIdWithNamespace(keyId: string): Promise<{ key: ApiKeyInfo; meshNamespaceId: string } | null> {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
        include: {
          developer_app: {
            select: {
              mesh_namespace_id: true,
            },
          },
        },
      })

      if (!apiKey || !apiKey.is_active) {
        return null
      }

      if (apiKey.expires_at && apiKey.expires_at < new Date()) {
        return null
      }

      return {
        key: this.mapToApiKeyInfo(apiKey),
        meshNamespaceId: apiKey.developer_app.mesh_namespace_id,
      }
    } catch (error) {
      logger.error('Error getting API key by ID with namespace:', error)
      return null
    }
  }

  async updateApiKey(
    keyId: string,
    developerAppId: string,
    updates: {
      name?: string
      description?: string
      rateLimit?: number | null
      rateLimitWindow?: number | null
      expiresAt?: Date | null
    }
  ): Promise<ApiKeyInfo> {
    try {
      const apiKey = await prisma.apiKey.update({
        where: {
          id: keyId,
          developer_app_id: developerAppId,
        },
        data: {
          name: updates.name,
          description: updates.description,
          rate_limit: updates.rateLimit,
          rate_limit_window: updates.rateLimitWindow,
          expires_at: updates.expiresAt,
        },
      })

      return this.mapToApiKeyInfo(apiKey)
    } catch (error) {
      logger.error('Error updating API key:', error)
      throw new AppError('Failed to update API key', 500)
    }
  }

  async revokeApiKey(keyId: string, developerAppId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: {
          id: keyId,
          developer_app_id: developerAppId,
        },
        data: {
          is_active: false,
        },
      })
    } catch (error) {
      logger.error('Error revoking API key:', error)
      throw new AppError('Failed to revoke API key', 500)
    }
  }

  private mapToApiKeyInfo(apiKey: {
    id: string
    developer_app_id: string
    key_prefix: string
    last_four: string
    name: string
    description: string | null
    rate_limit: number | null
    rate_limit_window: number | null
    expires_at: Date | null
    is_active: boolean
    last_used_at: Date | null
    usage_count: number
    created_at: Date
    updated_at: Date
  }): ApiKeyInfo {
    return {
      id: apiKey.id,
      developerAppId: apiKey.developer_app_id,
      keyPrefix: apiKey.key_prefix,
      lastFour: apiKey.last_four,
      name: apiKey.name,
      description: apiKey.description,
      rateLimit: apiKey.rate_limit,
      rateLimitWindow: apiKey.rate_limit_window,
      expiresAt: apiKey.expires_at,
      isActive: apiKey.is_active,
      lastUsedAt: apiKey.last_used_at,
      usageCount: apiKey.usage_count,
      created_at: apiKey.created_at,
      updated_at: apiKey.updated_at,
    }
  }
}

export const apiKeyService = new ApiKeyService()

