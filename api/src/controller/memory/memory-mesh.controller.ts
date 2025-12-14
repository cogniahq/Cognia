import { Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'
import { memoryMeshService } from '../../services/memory/memory-mesh.service'
import { logger } from '../../utils/core/logger.util'

export class MemoryMeshController {
  static async getMemoryMesh(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 'all', threshold = 0.3 } = req.query

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      const internalUserId: string | undefined = user.id

      const limitValue =
        limit === 'all' || limit === 'Infinity' ? Infinity : parseInt(limit as string)

      const mesh = await memoryMeshService.getMemoryMesh(
        internalUserId,
        undefined,
        limitValue,
        parseFloat(threshold as string)
      )

      res.status(200).json({
        success: true,
        data: mesh,
      })
    } catch (error) {
      logger.error('Error getting memory mesh:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  static async getMemoryWithRelations(req: AuthenticatedRequest, res: Response) {
    try {
      const { memoryId } = req.params

      if (!memoryId) {
        return res.status(400).json({
          success: false,
          error: 'memoryId is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const memoryWithRelations = await memoryMeshService.getMemoryWithRelations(memoryId)

      res.status(200).json({
        success: true,
        data: memoryWithRelations,
      })
    } catch (error) {
      logger.error('Error getting memory with relations:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  static async getMemoryCluster(req: AuthenticatedRequest, res: Response) {
    try {
      const { memoryId } = req.params
      const { depth = 2 } = req.query

      if (!memoryId) {
        return res.status(400).json({
          success: false,
          error: 'memoryId is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const cluster = await memoryMeshService.getMemoryCluster(
        user.id,
        memoryId,
        parseInt(depth as string)
      )

      res.status(200).json({
        success: true,
        data: cluster,
      })
    } catch (error) {
      logger.error('Error getting memory cluster:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  static async processMemoryForMesh(req: AuthenticatedRequest, res: Response) {
    try {
      const { memoryId } = req.params

      if (!memoryId) {
        return res.status(400).json({
          success: false,
          error: 'memoryId is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const memory = await prisma.memory.findFirst({
        where: {
          id: memoryId,
          user_id: user.id,
        },
      })

      if (!memory) {
        return res.status(404).json({
          success: false,
          error: "Memory not found or doesn't belong to user",
        })
      }

      await memoryMeshService.processMemoryForMesh(memoryId, user.id)
      res.status(200).json({
        success: true,
        message: 'Memory processed for mesh integration',
        data: {
          memoryId,
          processed: true,
        },
      })
    } catch (error) {
      logger.error('Error processing memory for mesh:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }
}
