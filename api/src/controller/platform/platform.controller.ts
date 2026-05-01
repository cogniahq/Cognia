import { NextFunction, Response } from 'express'
import { OrgRole } from '@prisma/client'

import { platformSyncService } from '../../services/platform/platform-sync.service'
import { platformDocumentService } from '../../services/platform/platform-document.service'
import { platformSearchService } from '../../services/platform/platform-search.service'
import type { PlatformAuthenticatedRequest } from '../../middleware/platform-auth.middleware'
import type {
  PlatformDocumentMetadata,
  PlatformSearchRequest,
  PlatformTenantRef,
  PlatformUserRef,
} from '../../types/platform.types'
import AppError from '../../utils/http/app-error.util'
import { auditLogService } from '../../services/core/audit-log.service'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export class PlatformController {
  private static async logEventIfPossible(
    req: PlatformAuthenticatedRequest,
    eventType:
      | 'platform_tenant_sync'
      | 'platform_user_sync'
      | 'platform_membership_sync'
      | 'platform_document_upload'
      | 'platform_search',
    action: string,
    metadata?: Record<string, unknown>
  ) {
    if (!req.platform?.userLink) {
      return
    }

    await auditLogService.logPlatformEvent(req.platform.userLink.user_id, eventType, action, {
      tenantExternalId: req.platform.actor.tenantExternalId,
      actorExternalUserId: req.platform.actor.actorExternalUserId,
      actorEmail: req.platform.actor.actorEmail,
      requestId: req.platform.actor.requestId,
      ...metadata,
    })
  }

  static async upsertTenant(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const tenant = req.body?.tenant as PlatformTenantRef | undefined

      if (!tenant?.externalId || !tenant.name) {
        return next(new AppError('tenant.externalId and tenant.name are required', 400))
      }

      const result = await platformSyncService.upsertTenant(req.platform!.app.app_id, tenant)

      await PlatformController.logEventIfPossible(req, 'platform_tenant_sync', 'upserted', {
        tenantExternalId: tenant.externalId,
        organizationId: result.organization.id,
      })

      res.status(200).json({
        success: true,
        data: {
          organization: result.organization,
          tenantLink: result.tenantLink,
        },
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to upsert tenant', 500))
    }
  }

  static async deactivateTenant(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { externalId } = req.params
      const link = await platformSyncService.deactivateTenant(req.platform!.app.app_id, externalId)

      await PlatformController.logEventIfPossible(req, 'platform_tenant_sync', 'deactivated', {
        tenantExternalId: externalId,
        organizationId: link.organization_id,
      })

      res.status(200).json({
        success: true,
        data: { tenantLink: link },
      })
    } catch (error) {
      next(
        new AppError(error instanceof Error ? error.message : 'Failed to deactivate tenant', 500)
      )
    }
  }

  static async upsertUser(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.body?.user as PlatformUserRef | undefined

      if (!user?.externalId || !user.email) {
        return next(new AppError('user.externalId and user.email are required', 400))
      }

      const result = await platformSyncService.upsertUser(req.platform!.app.app_id, user)

      await PlatformController.logEventIfPossible(req, 'platform_user_sync', 'upserted', {
        userExternalId: user.externalId,
        userId: result.user.id,
      })

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          userLink: result.userLink,
        },
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to upsert user', 500))
    }
  }

  static async deactivateUser(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { externalId } = req.params
      const link = await platformSyncService.deactivateUser(req.platform!.app.app_id, externalId)

      await PlatformController.logEventIfPossible(req, 'platform_user_sync', 'deactivated', {
        userExternalId: externalId,
        userId: link.user_id,
      })

      res.status(200).json({
        success: true,
        data: { userLink: link },
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to deactivate user', 500))
    }
  }

  static async syncMemberships(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantExternalId = req.body?.tenantExternalId as string | undefined
      const removeMissing = req.body?.removeMissing !== false
      const members = Array.isArray(req.body?.members)
        ? req.body.members.map((member: Record<string, unknown>) => ({
            userExternalId: String(member.userExternalId || ''),
            role: (member.role || OrgRole.VIEWER) as OrgRole,
          }))
        : []

      if (!tenantExternalId) {
        return next(new AppError('tenantExternalId is required', 400))
      }

      const result = await platformSyncService.syncMemberships(
        req.platform!.app.app_id,
        tenantExternalId,
        members,
        removeMissing
      )

      await PlatformController.logEventIfPossible(req, 'platform_membership_sync', 'synced', {
        tenantExternalId,
        memberCount: result.length,
      })

      res.status(200).json({
        success: true,
        data: {
          members: result,
        },
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to sync memberships', 500))
    }
  }

  static async createUploadSession(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { originalName, mimeType, fileSize, metadata } = req.body || {}

      if (!originalName || !mimeType || !fileSize) {
        return next(new AppError('originalName, mimeType, and fileSize are required', 400))
      }

      const session = await platformDocumentService.createUploadSession({
        appId: req.platform!.app.id,
        tenantLinkId: req.platform!.tenantLink!.id,
        userLinkId: req.platform!.userLink!.id,
        organizationId: req.platform!.tenantLink!.organization_id,
        uploaderId: req.platform!.userLink!.user_id,
        originalName,
        mimeType,
        fileSize: Number(fileSize),
        metadata: (metadata || {}) as PlatformDocumentMetadata,
      })

      await PlatformController.logEventIfPossible(
        req,
        'platform_document_upload',
        'session_created',
        {
          uploadSessionId: session.id,
          originalName,
        }
      )

      res.status(201).json({
        success: true,
        data: {
          session: {
            id: session.id,
            status: session.status,
            expiresAt: session.expires_at,
            originalName: session.original_name,
            mimeType: session.mime_type,
            fileSize: session.file_size,
          },
        },
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to create upload session',
          500
        )
      )
    }
  }

  static async uploadSessionContent(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const file = req.file as Express.Multer.File | undefined

      if (!file) {
        return next(new AppError('No file uploaded', 400))
      }

      if (file.size > MAX_FILE_SIZE) {
        return next(new AppError('File size exceeds maximum limit of 50MB', 400))
      }

      const session = await platformDocumentService.uploadSessionContent(req.params.sessionId, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      })

      await PlatformController.logEventIfPossible(
        req,
        'platform_document_upload',
        'content_uploaded',
        {
          uploadSessionId: session.id,
        }
      )

      res.status(200).json({
        success: true,
        data: {
          session: {
            id: session.id,
            status: session.status,
            uploadedAt: session.uploaded_at,
          },
        },
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to upload session content',
          500
        )
      )
    }
  }

  static async completeUploadSession(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const document = await platformDocumentService.completeUploadSession(req.params.sessionId)

      await PlatformController.logEventIfPossible(req, 'platform_document_upload', 'completed', {
        uploadSessionId: req.params.sessionId,
        documentId: document.id,
      })

      res.status(200).json({
        success: true,
        data: {
          document,
        },
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to complete upload session',
          500
        )
      )
    }
  }

  static async getDocument(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const document = await platformDocumentService.getDocument(
        req.params.documentId,
        req.platform!.tenantLink!.organization_id
      )

      if (!document) {
        return next(new AppError('Document not found', 404))
      }

      res.status(200).json({
        success: true,
        data: { document },
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to fetch document', 500))
    }
  }

  static async getDocumentDownloadUrl(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await platformDocumentService.getDownloadUrl(
        req.params.documentId,
        req.platform!.tenantLink!.organization_id
      )

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to fetch document download URL',
          500
        )
      )
    }
  }

  static async getDocumentContent(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await platformDocumentService.getDocumentContent(
        req.params.documentId,
        req.platform!.tenantLink!.organization_id
      )

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to fetch document content',
          500
        )
      )
    }
  }

  static async getCitationSource(
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const citation = await platformDocumentService.getCitationSource(
        req.params.memoryId,
        req.platform!.tenantLink!.organization_id
      )

      if (!citation) {
        return next(new AppError('Citation source not found', 404))
      }

      res.status(200).json({
        success: true,
        data: citation,
      })
    } catch (error) {
      next(
        new AppError(
          error instanceof Error ? error.message : 'Failed to fetch citation source',
          500
        )
      )
    }
  }

  static async querySearch(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as PlatformSearchRequest

      if (!body.query) {
        return next(new AppError('query is required', 400))
      }

      if (body.tenantExternalId !== req.platform!.actor.tenantExternalId) {
        return next(new AppError('tenantExternalId does not match actor context', 403))
      }

      const result = await platformSearchService.query(
        req.platform!.tenantLink!.organization_id,
        body
      )

      await PlatformController.logEventIfPossible(req, 'platform_search', 'queried', {
        query: body.query.slice(0, 200),
        resultCount: result.totalResults,
      })

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(new AppError(error instanceof Error ? error.message : 'Failed to execute search', 500))
    }
  }
}
