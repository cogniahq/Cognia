import { Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { Prisma } from '@prisma/client'

type MemorySelect = Prisma.MemoryGetPayload<{
  select: {
    id: true
    title: true
    url: true
    timestamp: true
    created_at: true
    content: true
    source: true
    page_metadata: true
  }
}>

export class MemoryCrudController {
  static async getRecentMemories(req: AuthenticatedRequest, res: Response) {
    try {
      const { count } = req.query
      const limit = Math.min(count ? parseInt(count as string) : 10, 100)

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        })
      }

      const userId = req.user.id

      const memories = await prisma.memory.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          title: true,
          url: true,
          timestamp: true,
          created_at: true,
          content: true,
          source: true,
          page_metadata: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      })

      const serializedMemories = memories.map((memory: MemorySelect) => ({
        ...memory,
        timestamp: memory.timestamp ? memory.timestamp.toString() : null,
      }))

      res.status(200).json({
        success: true,
        data: {
          userId: userId,
          count: limit,
          memories: serializedMemories,
          actualCount: memories.length,
        },
      })
    } catch (error) {
      logger.error('Error getting recent memories:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get recent memories',
      })
    }
  }

  static async getUserMemoryCount(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        })
      }

      const userId = req.user.id

      const count = await prisma.memory.count({
        where: { user_id: userId },
      })

      return res.status(200).json({
        success: true,
        data: {
          userId: userId,
          memoryCount: count,
        },
      })
    } catch (error) {
      logger.error('Error getting user memory count:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user memory count',
      })
    }
  }

  static async deleteMemory(req: AuthenticatedRequest, res: Response) {
    try {
      const { memoryId } = req.params

      if (!memoryId) {
        return res.status(400).json({
          success: false,
          error: 'Memory ID is required',
        })
      }

      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory) {
        return res.status(404).json({
          success: false,
          error: 'Memory not found',
        })
      }

      if (memory.user_id !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this memory',
        })
      }

      try {
        const { deleteMemoryPoints } = await import('../../lib/qdrant.lib')
        await deleteMemoryPoints([memoryId])
        logger.log('[memory/delete] qdrant_deleted', { memoryId })
      } catch (qdrantError) {
        logger.warn('[memory/delete] qdrant_delete_failed', {
          error: qdrantError instanceof Error ? qdrantError.message : String(qdrantError),
          memoryId,
        })
      }

      try {
        const { searchCache } = await import('../../services/search/search-cache.service')
        if (memory.organization_id) {
          await searchCache.invalidateOrganization(memory.organization_id)
        }
      } catch (cacheError) {
        logger.warn('[memory/delete] search_cache_invalidate_failed', {
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
          memoryId,
        })
      }

      try {
        const { getRedisClient, scanKeys } = await import('../../lib/redis.lib')
        const redis = getRedisClient()
        const keys = await scanKeys(redis, 'search_cache:*', 1000)
        for (const key of keys) {
          const cached = await redis.get(key)
          if (cached) {
            try {
              const data = JSON.parse(cached) as { results?: Array<{ memory_id?: string }> }
              if (data.results && Array.isArray(data.results)) {
                const hasMemory = data.results.some(r => r.memory_id === memoryId)
                if (hasMemory) {
                  await redis.del(key)
                  logger.log('[memory/delete] cache_cleared', { key, memoryId })
                }
              }
            } catch {
              // Invalid cache entry, skip
            }
          }
        }
      } catch (cacheError) {
        logger.warn('[memory/delete] cache_clear_failed', {
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
          memoryId,
        })
      }

      await prisma.memory.delete({
        where: { id: memoryId },
      })

      const { auditLogService } = await import('../../services/core/audit-log.service')
      auditLogService
        .logMemoryDelete(req.user!.id, memoryId, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        })
        .catch(err => {
          logger.warn('[memory/delete] audit_log_failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })

      res.status(200).json({
        success: true,
        message: 'Memory deleted successfully',
        data: {
          memoryId,
        },
      })
    } catch (error) {
      logger.error('Error deleting memory:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete memory',
      })
    }
  }
}
