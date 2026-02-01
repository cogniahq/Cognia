import { Router } from 'express'
import { SearchController } from '../controller/search/search.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireOrganization, requireOrgViewer } from '../middleware/organization.middleware'

const router = Router()

// Personal search endpoints
router.post('/', authenticateToken, SearchController.postSearch)
router.post('/context', authenticateToken, SearchController.getContext)
router.get('/job/:id', SearchController.getSearchJobStatus)

// Organization search endpoints
router.post(
  '/organization/:slug',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  SearchController.searchOrganization
)

router.post(
  '/organization/:slug/documents',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  SearchController.searchOrganizationDocuments
)

export default router
