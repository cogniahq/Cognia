import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { developerAppService } from '../../services/core/developer-app.service'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'

export class DeveloperAppController {
  static async createDeveloperApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { name, description } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return next(new AppError('name is required and must be a non-empty string', 400))
      }

      const app = await developerAppService.createDeveloperApp({
        developerId: req.user.id,
        name: name.trim(),
        description: description?.trim(),
      })

      res.status(201).json({
        success: true,
        data: app,
      })
    } catch (error) {
      logger.error('Error creating developer app:', error)
      next(error)
    }
  }

  static async listDeveloperApps(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const apps = await developerAppService.getDeveloperApps(req.user.id)

      res.status(200).json({
        success: true,
        data: apps,
      })
    } catch (error) {
      logger.error('Error listing developer apps:', error)
      next(error)
    }
  }

  static async getDeveloperApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { id } = req.params
      const app = await developerAppService.getDeveloperAppById(id, req.user.id)

      if (!app) {
        return next(new AppError('Developer app not found', 404))
      }

      res.status(200).json({
        success: true,
        data: app,
      })
    } catch (error) {
      logger.error('Error getting developer app:', error)
      next(error)
    }
  }

  static async updateDeveloperApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { id } = req.params
      const { name, description } = req.body

      const updates: {
        name?: string
        description?: string
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

      const updated = await developerAppService.updateDeveloperApp(id, req.user.id, updates)

      res.status(200).json({
        success: true,
        data: updated,
      })
    } catch (error) {
      logger.error('Error updating developer app:', error)
      next(error)
    }
  }

  static async deleteDeveloperApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const { id } = req.params
      await developerAppService.deleteDeveloperApp(id, req.user.id)

      res.status(200).json({
        success: true,
        message: 'Developer app deleted',
      })
    } catch (error) {
      logger.error('Error deleting developer app:', error)
      next(error)
    }
  }
}
