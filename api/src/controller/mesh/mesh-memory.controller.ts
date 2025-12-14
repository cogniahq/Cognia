import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { memoryMeshService } from '../../services/memory/memory-mesh.service'
import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'

export class MeshMemoryController {
  static async upsertMemories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.apiKey) {
        return next(new AppError('API key authentication required', 401))
      }

      const { memories } = req.body

      if (!Array.isArray(memories) || memories.length === 0) {
        return next(new AppError('memories must be a non-empty array', 400))
      }

      for (const memory of memories) {
        if (!memory.content || typeof memory.content !== 'string') {
          return next(new AppError('Each memory must have a content string', 400))
        }
      }

      const storedIds = await memoryMeshService.upsertMemories(
        req.apiKey.meshNamespaceId,
        req.apiKey.id,
        memories.map(m => ({
          id: m.id,
          content: m.content,
          metadata: m.metadata,
        }))
      )

      res.status(200).json({
        status: 'ok',
        stored_ids: storedIds,
      })
    } catch (error) {
      logger.error('Error upserting memories:', error)
      next(error)
    }
  }

  static async queryMemories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.apiKey) {
        return next(new AppError('API key authentication required', 401))
      }

      const { q, limit, filters } = req.query

      if (!q || typeof q !== 'string') {
        return next(new AppError('q query parameter is required', 400))
      }

      const limitNum = limit ? Number(limit) : 10
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return next(new AppError('limit must be a number between 1 and 100', 400))
      }

      const filtersObj = filters ? (typeof filters === 'string' ? JSON.parse(filters) : filters) : undefined

      const results = await memoryMeshService.queryMemories(
        req.apiKey.meshNamespaceId,
        q,
        filtersObj,
        limitNum
      )

      res.status(200).json({
        hits: results,
      })
    } catch (error) {
      logger.error('Error querying memories:', error)
      next(error)
    }
  }
}
