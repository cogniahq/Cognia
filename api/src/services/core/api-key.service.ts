import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'

const API_KEY_PREFIX = 'ck_'
const API_KEY_LENGTH = 32
const SALT_ROUNDS = 10

export interface CreateApiKeyConfig {
  userId: string
  name: string
  description?: string
  memoryIsolation?: boolean
  rateLimit?: number
  rateLimitWindow?: number
  expiresAt?: Date
}

export interface ApiKeyInfo {
  id: string
  userId: string
  keyPrefix: string
  name: string
  description?: string | null
  memoryIsolation: boolean
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

  async createApiKey(config: CreateApiKeyConfig): Promise<{ key: string; info: ApiKeyInfo }> {
    try {
      const key = this.generateApiKey()
      const keyHash = await this.hashApiKey(key)
      const keyPrefix = this.getKeyPrefix(key)

      const apiKey = await prisma.apiKey.create({
        data: {
          user_id: config.userId,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          name: config.name,
          description: config.description,
          memory_isolation: config.memoryIsolation ?? false,
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

  async findApiKeyByPlainKey(plainKey: string): Promise<ApiKeyInfo | null> {
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
      })

      for (const apiKey of apiKeys) {
        const isValid = await this.verifyApiKey(plainKey, apiKey.key_hash)
        if (isValid) {
          if (apiKey.expires_at && apiKey.expires_at < new Date()) {
            return null
          }
          return this.mapToApiKeyInfo(apiKey)
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

  async getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      })

      return apiKeys.map(key => this.mapToApiKeyInfo(key))
    } catch (error) {
      logger.error('Error getting user API keys:', error)
      throw new AppError('Failed to get API keys', 500)
    }
  }

  async getApiKeyById(keyId: string, userId: string): Promise<ApiKeyInfo | null> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: keyId,
          user_id: userId,
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

  async updateApiKey(
    keyId: string,
    userId: string,
    updates: {
      name?: string
      description?: string
      memoryIsolation?: boolean
      rateLimit?: number | null
      rateLimitWindow?: number | null
      expiresAt?: Date | null
    }
  ): Promise<ApiKeyInfo> {
    try {
      const apiKey = await prisma.apiKey.update({
        where: {
          id: keyId,
          user_id: userId,
        },
        data: {
          name: updates.name,
          description: updates.description,
          memory_isolation: updates.memoryIsolation,
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

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: {
          id: keyId,
          user_id: userId,
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
    user_id: string
    key_prefix: string
    name: string
    description: string | null
    memory_isolation: boolean
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
      userId: apiKey.user_id,
      keyPrefix: apiKey.key_prefix,
      name: apiKey.name,
      description: apiKey.description,
      memoryIsolation: apiKey.memory_isolation,
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

