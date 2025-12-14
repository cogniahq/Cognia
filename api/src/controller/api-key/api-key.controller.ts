import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { apiKeyService } from '../../services/core/api-key.service'
import { developerAppService } from '../../services/core/developer-app.service'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'

export class ApiKeyController {
  static async createApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id } = req.params
      const { name, description, rateLimit, rateLimitWindow, expiresAt } = req.body

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return next(new AppError('name is required and must be a non-empty string', 400))
      }

      const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined
      if (expiresAtDate && isNaN(expiresAtDate.getTime())) {
        return next(new AppError('expiresAt must be a valid date', 400))
      }

      const result = await apiKeyService.createApiKey({
        developerAppId: app_id,
        name: name.trim(),
        description: description?.trim(),
        rateLimit: rateLimit ? Number(rateLimit) : undefined,
        rateLimitWindow: rateLimitWindow ? Number(rateLimitWindow) : undefined,
        expiresAt: expiresAtDate,
      })

      res.status(201).json({
        success: true,
        data: {
          id: result.info.id,
          api_key: result.key,
          prefix: result.info.keyPrefix,
          last_four: result.info.lastFour,
          created_at: result.info.created_at,
        },
      })
    } catch (error) {
      logger.error('Error creating API key:', error)
      next(error)
    }
  }

  static async listApiKeys(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id } = req.params

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      const keys = await apiKeyService.getApiKeysByAppId(app_id)

      res.status(200).json({
        success: true,
        data: keys.map(key => ({
          id: key.id,
          name: key.name,
          description: key.description,
          prefix: key.keyPrefix,
          last_four: key.lastFour,
          rate_limit: key.rateLimit,
          rate_limit_window: key.rateLimitWindow,
          expires_at: key.expiresAt,
          is_active: key.isActive,
          last_used_at: key.lastUsedAt,
          usage_count: key.usageCount,
          created_at: key.created_at,
        })),
      })
    } catch (error) {
      logger.error('Error listing API keys:', error)
      next(error)
    }
  }

  static async getApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id, key_id } = req.params

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      const key = await apiKeyService.getApiKeyById(key_id, app_id)

      if (!key) {
        return next(new AppError('API key not found', 404))
      }

      res.status(200).json({
        success: true,
        data: {
          id: key.id,
          name: key.name,
          description: key.description,
          prefix: key.keyPrefix,
          last_four: key.lastFour,
          rate_limit: key.rateLimit,
          rate_limit_window: key.rateLimitWindow,
          expires_at: key.expiresAt,
          is_active: key.isActive,
          last_used_at: key.lastUsedAt,
          usage_count: key.usageCount,
          created_at: key.created_at,
        },
      })
    } catch (error) {
      logger.error('Error getting API key:', error)
      next(error)
    }
  }

  static async updateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id, key_id } = req.params
      const { name, description, rateLimit, rateLimitWindow, expiresAt } = req.body

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      const updates: {
        name?: string
        description?: string
        rateLimit?: number | null
        rateLimitWindow?: number | null
        expiresAt?: Date | null
      } = {}

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return next(new AppError('name must be a non-empty string', 400))
        }
        updates.name = name.trim()
      }

      if (description !== undefined) {
        updates.description = description === null ? null : String(description).trim()
      }

      if (rateLimit !== undefined) {
        updates.rateLimit = rateLimit === null ? null : Number(rateLimit)
      }

      if (rateLimitWindow !== undefined) {
        updates.rateLimitWindow = rateLimitWindow === null ? null : Number(rateLimitWindow)
      }

      if (expiresAt !== undefined) {
        if (expiresAt === null) {
          updates.expiresAt = null
        } else {
          const expiresAtDate = new Date(expiresAt)
          if (isNaN(expiresAtDate.getTime())) {
            return next(new AppError('expiresAt must be a valid date', 400))
          }
          updates.expiresAt = expiresAtDate
        }
      }

      const updated = await apiKeyService.updateApiKey(key_id, app_id, updates)

      res.status(200).json({
        success: true,
        data: updated,
      })
    } catch (error) {
      logger.error('Error updating API key:', error)
      next(error)
    }
  }

  static async revokeApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id, key_id } = req.params

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      await apiKeyService.revokeApiKey(key_id, app_id)

      res.status(200).json({
        success: true,
        message: 'API key revoked',
      })
    } catch (error) {
      logger.error('Error revoking API key:', error)
      next(error)
    }
  }

  static async getApiKeyUsage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { app_id, key_id } = req.params

      const app = await developerAppService.getDeveloperAppById(app_id, req.user.id)
      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      const key = await apiKeyService.getApiKeyById(key_id, app_id)

      if (!key) {
        return next(new AppError('API key not found', 404))
      }

      res.status(200).json({
        success: true,
        data: {
          usageCount: key.usageCount,
          lastUsedAt: key.lastUsedAt,
        },
      })
    } catch (error) {
      logger.error('Error getting API key usage:', error)
      next(error)
    }
  }
}

