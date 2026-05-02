import { Request, Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'
import { memoryRedactionService } from '../../services/memory/memory-redaction.service'
import { logger } from '../../utils/core/logger.util'
import { resolveActiveOrgContext } from '../../utils/org/active-context.util'
import { MemoryCrudController } from './memory-crud.controller'
import { MemoryProcessingController } from './memory-processing.controller'

export class MemoryController {
  static async processRawContent(req: AuthenticatedRequest, res: Response) {
    return MemoryProcessingController.processRawContent(req, res)
  }

  static async getRecentMemories(req: AuthenticatedRequest, res: Response) {
    return MemoryCrudController.getRecentMemories(req, res)
  }

  static async getUserMemoryCount(req: AuthenticatedRequest, res: Response) {
    return MemoryCrudController.getUserMemoryCount(req, res)
  }

  static async deleteMemory(req: AuthenticatedRequest, res: Response) {
    return MemoryCrudController.deleteMemory(req, res)
  }

  static async healthCheck(req: Request, res: Response) {
    try {
      res.status(200).json({ success: true, message: 'OK', timestamp: new Date().toISOString() })
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        details: error.message,
      })
    }
  }

  static async debugMemories(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        })
      }

      const userId = req.user.id

      // Same scoping rule as getRecentMemories: optional ?organizationId scopes
      // to the active org (caller must be a member); absent => personal vault.
      const ctx = await resolveActiveOrgContext(
        userId,
        req.query.organizationId as string | undefined
      )
      if (!ctx.authorized) {
        return res.status(403).json({
          success: false,
          error: 'Not a member of organization',
        })
      }

      const memories = await prisma.memory.findMany({
        where: { user_id: userId, organization_id: ctx.organizationId },
        select: {
          id: true,
          title: true,
          url: true,
          source: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      })

      res.status(200).json({
        success: true,
        data: {
          user_id: userId,
          total_memories: memories.length,
          recent_memories: memories,
        },
      })
    } catch (error) {
      logger.error('Debug memories error:', error)
      res.status(500).json({
        success: false,
        error: 'Debug failed',
      })
    }
  }

  static async redactMemory(req: AuthenticatedRequest, res: Response) {
    try {
      const { memoryId } = req.params
      const { fields } = req.body

      if (!memoryId) {
        return res.status(400).json({
          success: false,
          error: 'Memory ID is required',
        })
      }

      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Fields to redact are required (array of: url, content, title)',
        })
      }

      const validFields = ['url', 'content', 'title']
      const invalidFields = fields.filter(f => !validFields.includes(f))
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`,
        })
      }

      const redacted = await memoryRedactionService.redactMemoryFields(
        req.user!.id,
        memoryId,
        fields,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }
      )

      res.status(200).json({
        success: true,
        message: 'Memory fields redacted successfully',
        data: {
          memoryId: redacted.id,
          fieldsRedacted: fields,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to redact memory'
      logger.error('Error redacting memory:', error)
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  static async redactDomainMemories(req: AuthenticatedRequest, res: Response) {
    try {
      const { domain, fields } = req.body

      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Domain is required',
        })
      }

      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Fields to redact are required (array of: url, content, title)',
        })
      }

      const validFields = ['url', 'content', 'title']
      const invalidFields = fields.filter(f => !validFields.includes(f))
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`,
        })
      }

      const result = await memoryRedactionService.redactDomainMemories(
        req.user!.id,
        domain,
        fields,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }
      )

      res.status(200).json({
        success: true,
        message: 'Domain memories redacted successfully',
        data: result,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to redact domain memories'
      logger.error('Error redacting domain memories:', error)
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }
}
