import { Router } from 'express'
import { SearchController } from '../controller/search/search.controller'
import { authenticateToken, authenticateTokenWithQuery } from '../middleware/auth.middleware'
import { requireOrganization, requireOrgViewer } from '../middleware/organization.middleware'
import { enforceIpAllowlist } from '../middleware/ip-allowlist.middleware'
import { enforceSessionTimeout } from '../middleware/session-timeout.middleware'
import { enforce2FARequirement } from '../middleware/require-2fa.middleware'
import { searchRateLimiter } from '../middleware/rate-limit.middleware'

const router = Router()

// Personal search endpoints
router.post('/', authenticateToken, searchRateLimiter, SearchController.postSearch)
router.post('/context', authenticateToken, searchRateLimiter, SearchController.getContext)
router.get('/job/:id', authenticateToken, SearchController.getSearchJobStatus)
router.get('/job/:id/stream', authenticateTokenWithQuery, SearchController.streamSearchJob)

// Organization search endpoints
router.post(
  '/organization/:slug',
  authenticateToken,
  searchRateLimiter,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  SearchController.searchOrganization
)

router.post(
  '/organization/:slug/documents',
  authenticateToken,
  searchRateLimiter,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  SearchController.searchOrganizationDocuments
)

export default router
