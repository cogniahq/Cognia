import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { addContentJob, ContentJobData } from '../../lib/queue.lib'
import { prisma } from '../../lib/prisma.lib'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'
import { buildContentPreview } from '../../utils/text/text.util'
import { MemoryProcessingController } from '../memory/memory-processing.controller'
import { scanForSecrets } from '../../services/integration/server-dlp.service'

export class ContentController {
  static async submitContent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user_id = req.user!.id
      const raw_text = (req.body.raw_text || req.body.content || req.body.text) as
        | string
        | undefined
      const metadata = req.body.metadata as Record<string, unknown> | undefined
      const url =
        typeof req.body.url === 'string' && req.body.url.trim() !== ''
          ? req.body.url.trim()
          : undefined
      const title =
        typeof req.body.title === 'string' && req.body.title.trim() !== ''
          ? req.body.title.trim()
          : undefined

      if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length === 0) {
        return next(new AppError('raw_text, content, or text is required', 400))
      }

      // Server-side DLP: scan for high-confidence secret patterns and reject the
      // capture if any matched. The extension also runs a client-side scan, this
      // is the defence-in-depth gate for any other API caller.
      const dlp = scanForSecrets(raw_text)
      if (dlp.blocked) {
        logger.warn('[content] DLP blocked submission', {
          userId: user_id,
          matches: dlp.matches,
        })
        return res.status(422).json({
          success: false,
          code: 'DLP_BLOCKED',
          message: 'Content contains sensitive data and was not stored',
          matches: dlp.matches,
        })
      }

      const jobData: ContentJobData = {
        user_id,
        raw_text: raw_text.trim(),
        metadata: {
          ...(metadata || {}),
          ...(url ? { url } : {}),
          ...(title ? { title } : {}),
        },
      }

      try {
        await addContentJob(jobData)

        res.status(202).json({
          success: true,
          message: 'Content submitted for processing',
        })
      } catch (error) {
        logger.warn('[content] queue submission failed, falling back to synchronous processing', {
          userId: user_id,
          error: error instanceof Error ? error.message : String(error),
        })

        req.body = {
          ...req.body,
          content: raw_text.trim(),
          ...(metadata ? { metadata } : {}),
          ...(url ? { url } : {}),
          ...(title ? { title } : {}),
        }

        return MemoryProcessingController.processRawContent(req, res)
      }
    } catch (err) {
      next(err)
    }
  }

  static async getSummarizedContent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const limit = req.query.limit ? Number(req.query.limit) : 20
      const page = req.query.page ? Number(req.query.page) : 1
      const limitNum = Math.min(limit, 100)
      const skip = (page - 1) * limitNum

      const [memories, total] = await Promise.all([
        prisma.memory.findMany({
          where: { user_id: userId },
          select: {
            id: true,
            title: true,
            url: true,
            content: true,
            created_at: true,
            page_metadata: true,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.memory.count({
          where: { user_id: userId },
        }),
      ])

      const summarized = memories.map(memory => ({
        id: memory.id,
        title: memory.title,
        url: memory.url,
        preview: buildContentPreview(memory.content),
        created_at: memory.created_at,
        metadata: memory.page_metadata,
      }))

      res.status(200).json({
        success: true,
        data: {
          memories: summarized,
          pagination: {
            page,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      })
    } catch (error) {
      logger.error('Error fetching summarized content:', error)
      next(error)
    }
  }
}
