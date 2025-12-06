import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { apiKeyService } from '../../services/core/api-key.service'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'

export class ApiKeyController {
  static async createApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { name, description, memoryIsolation, rateLimit, rateLimitWindow, expiresAt } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return next(new AppError('name is required and must be a non-empty string', 400))
      }

      const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined
      if (expiresAtDate && isNaN(expiresAtDate.getTime())) {
        return next(new AppError('expiresAt must be a valid date', 400))
      }

      const result = await apiKeyService.createApiKey({
        userId: req.user.id,
        name: name.trim(),
        description: description?.trim(),
        memoryIsolation: Boolean(memoryIsolation),
        rateLimit: rateLimit ? Number(rateLimit) : undefined,
        rateLimitWindow: rateLimitWindow ? Number(rateLimitWindow) : undefined,
        expiresAt: expiresAtDate,
      })

      res.status(201).json({
        success: true,
        data: {
          key: result.key,
          info: result.info,
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

      const keys = await apiKeyService.getUserApiKeys(req.user.id)

      res.status(200).json({
        success: true,
        data: keys,
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

      const { id } = req.params
      const key = await apiKeyService.getApiKeyById(id, req.user.id)

      if (!key) {
        return next(new AppError('API key not found', 404))
      }

      res.status(200).json({
        success: true,
        data: key,
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

      const { id } = req.params
      const { name, description, memoryIsolation, rateLimit, rateLimitWindow, expiresAt } = req.body

      const updates: {
        name?: string
        description?: string
        memoryIsolation?: boolean
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

      if (memoryIsolation !== undefined) {
        updates.memoryIsolation = Boolean(memoryIsolation)
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

      const updated = await apiKeyService.updateApiKey(id, req.user.id, updates)

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

      const { id } = req.params
      await apiKeyService.revokeApiKey(id, req.user.id)

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

      const { id } = req.params
      const key = await apiKeyService.getApiKeyById(id, req.user.id)

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

