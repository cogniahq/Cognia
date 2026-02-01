import { Response, NextFunction } from 'express'
import { OrganizationRequest } from '../../middleware/organization.middleware'
import { documentService } from '../../services/document/document.service'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'
import { DocumentStatus } from '@prisma/client'

// Supported MIME types for document upload
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/markdown',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export class DocumentController {
  /**
   * Upload a document
   * POST /api/organizations/:slug/documents
   */
  static async uploadDocument(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file as Express.Multer.File | undefined

      if (!file) {
        return next(new AppError('No file uploaded', 400))
      }

      if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
        return next(
          new AppError(
            `Unsupported file type: ${file.mimetype}. Supported types: PDF, DOCX, images, text`,
            400
          )
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return next(new AppError('File size exceeds maximum limit of 50MB', 400))
      }

      const document = await documentService.uploadDocument({
        organizationId: req.organization!.id,
        uploaderId: req.user!.id,
        file: {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
      })

      res.status(202).json({
        success: true,
        message: 'Document uploaded and queued for processing',
        data: {
          document: {
            id: document.id,
            organization_id: document.organization_id,
            original_name: document.original_name,
            mime_type: document.mime_type,
            size_bytes: document.file_size,
            status: document.status,
            created_at: document.created_at,
            updated_at: document.updated_at,
          },
        },
      })
    } catch (error) {
      logger.error('[document] Upload error', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to upload document', 500))
    }
  }

  /**
   * List documents for organization
   * GET /api/organizations/:slug/documents
   */
  static async listDocuments(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { status, limit, offset } = req.query

      const result = await documentService.listDocuments(req.organization!.id, {
        status: status as DocumentStatus | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      })

      res.status(200).json({
        success: true,
        data: {
          documents: result.documents.map(doc => ({
            id: doc.id,
            organization_id: doc.organization_id,
            uploader_id: doc.uploader_id,
            original_name: doc.original_name,
            storage_path: doc.storage_path,
            mime_type: doc.mime_type,
            size_bytes: doc.file_size,
            status: doc.status,
            error_message: doc.error_message,
            page_count: doc.page_count,
            metadata: doc.metadata,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
          })),
        },
        pagination: {
          total: result.total,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      })
    } catch (error) {
      logger.error('[document] List error', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to list documents', 500))
    }
  }

  /**
   * Get document details
   * GET /api/organizations/:slug/documents/:documentId
   */
  static async getDocument(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params

      const document = await documentService.getDocument(documentId, req.organization!.id)

      if (!document) {
        return next(new AppError('Document not found', 404))
      }

      const chunks = await documentService.getChunks(documentId)

      res.status(200).json({
        success: true,
        data: {
          document: {
            id: document.id,
            organization_id: document.organization_id,
            uploader_id: document.uploader_id,
            original_name: document.original_name,
            storage_path: document.storage_path,
            mime_type: document.mime_type,
            size_bytes: document.file_size,
            status: document.status,
            error_message: document.error_message,
            page_count: document.page_count,
            metadata: document.metadata,
            created_at: document.created_at,
            updated_at: document.updated_at,
            chunks: chunks.map(c => ({
              id: c.id,
              chunkIndex: c.chunk_index,
              pageNumber: c.page_number,
              contentPreview: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
            })),
          },
        },
      })
    } catch (error) {
      logger.error('[document] Get error', {
        error: error instanceof Error ? error.message : String(error),
        documentId: req.params.documentId,
      })
      next(new AppError('Failed to get document', 500))
    }
  }

  /**
   * Download document
   * GET /api/organizations/:slug/documents/:documentId/download
   */
  static async downloadDocument(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params

      const downloadUrl = await documentService.getDownloadUrl(documentId, req.organization!.id)

      res.status(200).json({
        success: true,
        data: {
          downloadUrl,
          expiresIn: 3600, // 1 hour
        },
      })
    } catch (error) {
      logger.error('[document] Download error', {
        error: error instanceof Error ? error.message : String(error),
        documentId: req.params.documentId,
      })

      if (error instanceof Error && error.message === 'Document not found') {
        return next(new AppError('Document not found', 404))
      }

      next(new AppError('Failed to get download URL', 500))
    }
  }

  /**
   * Delete document
   * DELETE /api/organizations/:slug/documents/:documentId
   */
  static async deleteDocument(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params

      await documentService.deleteDocument(documentId, req.organization!.id)

      res.status(200).json({
        success: true,
        message: 'Document deleted',
      })
    } catch (error) {
      logger.error('[document] Delete error', {
        error: error instanceof Error ? error.message : String(error),
        documentId: req.params.documentId,
      })

      if (error instanceof Error && error.message === 'Document not found') {
        return next(new AppError('Document not found', 404))
      }

      next(new AppError('Failed to delete document', 500))
    }
  }

  /**
   * Reprocess failed document
   * POST /api/organizations/:slug/documents/:documentId/reprocess
   */
  static async reprocessDocument(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params

      await documentService.reprocessDocument(documentId, req.organization!.id)

      res.status(202).json({
        success: true,
        message: 'Document queued for reprocessing',
      })
    } catch (error) {
      logger.error('[document] Reprocess error', {
        error: error instanceof Error ? error.message : String(error),
        documentId: req.params.documentId,
      })

      if (error instanceof Error && error.message.includes('not found')) {
        return next(new AppError(error.message, 404))
      }

      next(new AppError('Failed to reprocess document', 500))
    }
  }
}
