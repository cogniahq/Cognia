import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'
import { briefingService } from '../../services/briefing/briefing.service'
import { briefingGenerationService } from '../../services/briefing/briefing-generation.service'
import { BriefingType } from '@prisma/client'

export class BriefingController {
  static async listBriefings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const type = req.query.type as BriefingType | undefined
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

      const result = await briefingService.listBriefings(userId, {
        type,
        limit,
        offset,
      })
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error listing briefings:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to list briefings', 500))
    }
  }

  static async getLatestBriefings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.getLatestBriefings(userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error getting latest briefings:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to get latest briefings', 500))
    }
  }

  static async getBriefing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.getBriefing(req.params.id, userId)
      if (!result) {
        return next(new AppError('Briefing not found', 404))
      }
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error getting briefing:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to get briefing', 500))
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.markAsRead(req.params.id, userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error marking briefing as read:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to mark briefing as read', 500))
    }
  }

  static async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.getUnreadCount(userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error getting unread count:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to get unread count', 500))
    }
  }

  static async getPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.getOrCreatePreferences(userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error getting preferences:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to get preferences', 500))
    }
  }

  static async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id
      const result = await briefingService.updatePreferences(userId, req.body)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[briefing] Error updating preferences:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to update preferences', 500))
    }
  }

  static async generateNow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }
      const userId = req.user.id

      const now = new Date()
      const periodStart = new Date(now)
      periodStart.setHours(0, 0, 0, 0)
      const periodEnd = now

      const result = await briefingGenerationService.generateDailyDigest(
        userId,
        periodStart,
        periodEnd
      )

      if (!result) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'No memories to summarize',
        })
      }

      const briefing = await briefingService.createBriefing({
        userId,
        briefingType: BriefingType.DAILY_DIGEST,
        periodStart,
        periodEnd,
        summary: result.summary,
        topics: result.topics,
        wowFacts: result.wow_facts,
        knowledgeGaps: result.knowledge_gaps,
        connections: result.connections,
      })

      res.status(200).json({ success: true, data: briefing })
    } catch (error) {
      logger.error('[briefing] Error generating briefing:', {
        error: error instanceof Error ? error.message : String(error),
      })
      next(new AppError('Failed to generate briefing', 500))
    }
  }
}
