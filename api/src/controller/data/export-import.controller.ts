import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import AppError from '../../utils/http/app-error.util'
import { exportImportService } from '../../services/core/export-import.service'
import { auditLogService } from '../../services/core/audit-log.service'
import { logger } from '../../utils/core/logger.util'

export class ExportImportController {
  /**
   * GET /api/export
   * Export all user data as a JSON bundle
   */
  static async exportUserData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      logger.log('[export] Export request received', { userId: req.user.id })

      const bundle = await exportImportService.exportUserData(req.user.id)

      await auditLogService
        .logEvent({
          userId: req.user.id,
          eventType: 'data_exported',
          eventCategory: 'data_management',
          action: 'export-user-data',
          metadata: {
            memoryCount: Array.isArray((bundle as { memories?: unknown[] }).memories)
              ? (bundle as { memories: unknown[] }).memories.length
              : undefined,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})

      res.setHeader('Content-Type', 'application/json')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cognia-export-${req.user.id}-${Date.now()}.json"`
      )

      res.status(200).json(bundle)
    } catch (error) {
      logger.error('[export] Error exporting user data:', error)
      next(new AppError('Failed to export user data', 500))
    }
  }

  /**
   * POST /api/import
   * Import user data from a JSON bundle
   */
  static async importUserData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const bundle = req.body

      if (!bundle || !bundle.version) {
        return next(new AppError('Invalid bundle format', 400))
      }

      logger.log('[import] Import request received', {
        userId: req.user.id,
        bundleVersion: bundle.version,
        memoryCount: bundle.memories?.length || 0,
      })

      const result = await exportImportService.importUserData(req.user.id, bundle)

      await auditLogService
        .logEvent({
          userId: req.user.id,
          eventType: 'data_imported',
          eventCategory: 'data_management',
          action: 'import-user-data',
          metadata: {
            bundleVersion: bundle?.version,
            memoryCount: Array.isArray(bundle?.memories) ? bundle.memories.length : undefined,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error('[import] Error importing user data:', error)
      next(
        new AppError(
          `Failed to import user data: ${error instanceof Error ? error.message : String(error)}`,
          500
        )
      )
    }
  }
}
