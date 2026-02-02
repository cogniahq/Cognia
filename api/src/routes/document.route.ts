import { Router } from 'express'
import multer from 'multer'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  requireOrgEditor,
  requireOrgViewer,
} from '../middleware/organization.middleware'
import { enforceIpAllowlist } from '../middleware/ip-allowlist.middleware'
import { enforceSessionTimeout } from '../middleware/session-timeout.middleware'
import { enforce2FARequirement } from '../middleware/require-2fa.middleware'
import { DocumentController } from '../controller/document/document.controller'

const router = Router()

// Configure multer for memory storage (we'll upload to our storage provider)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

// Document routes - all require organization context, IP allowlist, and session timeout check
router.post(
  '/:slug/documents',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgEditor,
  upload.single('file'),
  DocumentController.uploadDocument
)

router.get(
  '/:slug/documents',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  DocumentController.listDocuments
)

router.get(
  '/:slug/documents/by-memory/:memoryId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  DocumentController.getDocumentByMemory
)

router.get(
  '/:slug/documents/:documentId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  DocumentController.getDocument
)

router.get(
  '/:slug/documents/:documentId/download',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  DocumentController.downloadDocument
)

router.delete(
  '/:slug/documents/:documentId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  DocumentController.deleteDocument
)

router.post(
  '/:slug/documents/:documentId/reprocess',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgEditor,
  DocumentController.reprocessDocument
)

export default router
