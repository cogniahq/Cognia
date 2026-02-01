import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  requireOrgViewer,
} from '../middleware/organization.middleware'
import { OrganizationController } from '../controller/organization/organization.controller'

const router = Router()

// Organization CRUD
router.post('/', authenticateToken, OrganizationController.createOrganization)
router.get('/', authenticateToken, OrganizationController.listOrganizations)
router.get('/user/organizations', authenticateToken, OrganizationController.listOrganizations)
router.get(
  '/:slug',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.getOrganization
)
router.put(
  '/:slug',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.updateOrganization
)
router.delete(
  '/:slug',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.deleteOrganization
)

// Member management
router.post(
  '/:slug/members',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.addMember
)
router.get(
  '/:slug/members',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.listMembers
)
router.put(
  '/:slug/members/:memberId',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.updateMember
)
router.delete(
  '/:slug/members/:memberId',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.removeMember
)

// Memory endpoints (for mesh visualization)
router.get(
  '/:slug/memories',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.getMemories
)
router.get(
  '/:slug/memories/count',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.getMemoryCount
)
router.get(
  '/:slug/mesh',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.getMesh
)

export default router
