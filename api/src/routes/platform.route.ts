import { Router } from 'express'
import multer from 'multer'

import { PlatformController } from '../controller/platform/platform.controller'
import {
  authenticatePlatformApp,
  requirePlatformActorAccess,
  requirePlatformTenantAccess,
} from '../middleware/platform-auth.middleware'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
})

router.use(authenticatePlatformApp)

router.post('/v1/tenants/upsert', PlatformController.upsertTenant)
router.post('/v1/tenants/:externalId/deactivate', PlatformController.deactivateTenant)
router.post('/v1/users/upsert', PlatformController.upsertUser)
router.post('/v1/users/:externalId/deactivate', PlatformController.deactivateUser)
router.post('/v1/memberships/sync', PlatformController.syncMemberships)

router.post(
  '/v1/documents/upload-sessions',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.createUploadSession
)
router.put(
  '/v1/documents/upload-sessions/:sessionId/content',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  upload.single('file'),
  PlatformController.uploadSessionContent
)
router.post(
  '/v1/documents/upload-sessions/:sessionId/complete',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.completeUploadSession
)
router.get(
  '/v1/documents/:documentId',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.getDocument
)
router.get(
  '/v1/documents/:documentId/download-url',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.getDocumentDownloadUrl
)
router.get(
  '/v1/documents/:documentId/content',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.getDocumentContent
)
router.get(
  '/v1/documents/citations/:memoryId',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.getCitationSource
)
router.post(
  '/v1/search/query',
  requirePlatformTenantAccess,
  requirePlatformActorAccess,
  PlatformController.querySearch
)

export default router
