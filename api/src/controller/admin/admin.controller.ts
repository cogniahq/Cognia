import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { adminService } from '../../services/admin/admin.service'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'
import { UserRole, DocumentStatus } from '@prisma/client'

export class AdminController {
  /**
   * Get dashboard statistics
   */
  static async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats()
      res.status(200).json({ success: true, data: stats })
    } catch (error) {
      logger.error('[admin] Error getting dashboard', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to get dashboard stats', 500))
    }
  }

  /**
   * List all users
   */
  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string | undefined
      const role = req.query.role as UserRole | undefined

      const result = await adminService.listUsers(page, limit, search, role)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[admin] Error listing users', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to list users', 500))
    }
  }

  /**
   * Get user details
   */
  static async getUserDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params
      const user = await adminService.getUserDetails(userId)

      if (!user) {
        return next(new AppError('User not found', 404))
      }

      res.status(200).json({ success: true, data: user })
    } catch (error) {
      logger.error('[admin] Error getting user details', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        targetUserId: req.params.userId,
      })
      next(new AppError('Failed to get user details', 500))
    }
  }

  /**
   * Update user role
   */
  static async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params
      const { role } = req.body

      if (!role || !['USER', 'ADMIN'].includes(role)) {
        return next(new AppError('Invalid role. Must be USER or ADMIN', 400))
      }

      // Prevent self-demotion
      if (userId === req.user?.id && role !== 'ADMIN') {
        return next(new AppError('Cannot change your own role', 400))
      }

      await adminService.updateUserRole(userId, role as UserRole)
      res.status(200).json({ success: true, message: 'User role updated' })
    } catch (error) {
      logger.error('[admin] Error updating user role', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        targetUserId: req.params.userId,
      })
      next(new AppError('Failed to update user role', 500))
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params

      // Prevent self-deletion
      if (userId === req.user?.id) {
        return next(new AppError('Cannot delete your own account', 400))
      }

      await adminService.deleteUser(userId)
      res.status(200).json({ success: true, message: 'User deleted' })
    } catch (error) {
      logger.error('[admin] Error deleting user', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        targetUserId: req.params.userId,
      })
      next(new AppError('Failed to delete user', 500))
    }
  }

  /**
   * List all organizations
   */
  static async listOrganizations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string | undefined
      const plan = req.query.plan as string | undefined

      const result = await adminService.listOrganizations(page, limit, search, plan)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[admin] Error listing organizations', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to list organizations', 500))
    }
  }

  /**
   * Get organization details
   */
  static async getOrganizationDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { orgId } = req.params
      const org = await adminService.getOrganizationDetails(orgId)

      if (!org) {
        return next(new AppError('Organization not found', 404))
      }

      res.status(200).json({ success: true, data: org })
    } catch (error) {
      logger.error('[admin] Error getting organization details', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        orgId: req.params.orgId,
      })
      next(new AppError('Failed to get organization details', 500))
    }
  }

  /**
   * Update organization plan
   */
  static async updateOrganizationPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { orgId } = req.params
      const { plan } = req.body

      if (!plan || !['free', 'pro', 'enterprise'].includes(plan)) {
        return next(new AppError('Invalid plan. Must be free, pro, or enterprise', 400))
      }

      await adminService.updateOrganizationPlan(orgId, plan)
      res.status(200).json({ success: true, message: 'Organization plan updated' })
    } catch (error) {
      logger.error('[admin] Error updating organization plan', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        orgId: req.params.orgId,
      })
      next(new AppError('Failed to update organization plan', 500))
    }
  }

  /**
   * Delete organization
   */
  static async deleteOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { orgId } = req.params
      await adminService.deleteOrganization(orgId)
      res.status(200).json({ success: true, message: 'Organization deleted' })
    } catch (error) {
      logger.error('[admin] Error deleting organization', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        orgId: req.params.orgId,
      })
      next(new AppError('Failed to delete organization', 500))
    }
  }

  /**
   * List all documents
   */
  static async listDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const status = req.query.status as DocumentStatus | undefined
      const orgId = req.query.orgId as string | undefined

      const result = await adminService.listDocuments(page, limit, status, orgId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[admin] Error listing documents', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to list documents', 500))
    }
  }

  /**
   * Reprocess document
   */
  static async reprocessDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params
      await adminService.reprocessDocument(documentId)
      res.status(200).json({ success: true, message: 'Document queued for reprocessing' })
    } catch (error) {
      logger.error('[admin] Error reprocessing document', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        documentId: req.params.documentId,
      })
      next(new AppError('Failed to reprocess document', 500))
    }
  }

  /**
   * Get analytics data
   */
  static async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30
      const analytics = await adminService.getAnalytics(days)
      res.status(200).json({ success: true, data: analytics })
    } catch (error) {
      logger.error('[admin] Error getting analytics', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to get analytics', 500))
    }
  }

  /**
   * Get storage analytics data
   */
  static async getStorageAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30
      const storageAnalytics = await adminService.getStorageAnalytics(days)
      res.status(200).json({ success: true, data: storageAnalytics })
    } catch (error) {
      logger.error('[admin] Error getting storage analytics', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to get storage analytics', 500))
    }
  }

  /**
   * Get document download URL (admin access to any document)
   */
  static async getDocumentDownloadUrl(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { documentId } = req.params
      const result = await adminService.getDocumentDownloadUrl(documentId)
      res.status(200).json({
        success: true,
        data: {
          downloadUrl: result.url,
          filename: result.filename,
          expiresIn: 3600,
        },
      })
    } catch (error) {
      logger.error('[admin] Error getting document download URL', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        documentId: req.params.documentId,
      })

      if (error instanceof Error && error.message === 'Document not found') {
        return next(new AppError('Document not found', 404))
      }

      next(new AppError('Failed to get download URL', 500))
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const userId = req.query.userId as string | undefined
      const eventType = req.query.eventType as string | undefined

      const result = await adminService.getAuditLogs(page, limit, userId, eventType)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      logger.error('[admin] Error getting audit logs', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to get audit logs', 500))
    }
  }

  // Keep legacy stats endpoint for backward compatibility
  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return AdminController.getDashboard(req, res, next)
  }
}
