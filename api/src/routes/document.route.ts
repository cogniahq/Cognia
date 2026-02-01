import { Router } from 'express'
import multer from 'multer'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  requireOrgEditor,
  requireOrgViewer,
} from '../middleware/organization.middleware'
import { DocumentController } from '../controller/document/document.controller'

const router = Router()

// Configure multer for memory storage (we'll upload to our storage provider)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

// Document routes - all require organization context
router.post(
  '/:slug/documents',
  authenticateToken,
  requireOrganization,
  requireOrgEditor,
  upload.single('file'),
  DocumentController.uploadDocument
)

router.get(
  '/:slug/documents',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  DocumentController.listDocuments
)

router.get(
  '/:slug/documents/:documentId',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  DocumentController.getDocument
)

router.get(
  '/:slug/documents/:documentId/download',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  DocumentController.downloadDocument
)

router.delete(
  '/:slug/documents/:documentId',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  DocumentController.deleteDocument
)

router.post(
  '/:slug/documents/:documentId/reprocess',
  authenticateToken,
  requireOrganization,
  requireOrgEditor,
  DocumentController.reprocessDocument
)

export default router
