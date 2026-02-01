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

// Enterprise setup endpoints
router.put(
  '/:slug/profile',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.updateProfile
)
router.put(
  '/:slug/billing',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.updateBilling
)
router.put(
  '/:slug/security',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.updateSecurity
)
router.get(
  '/:slug/setup',
  authenticateToken,
  requireOrganization,
  requireOrgViewer,
  OrganizationController.getSetupProgress
)
router.post(
  '/:slug/setup/skip',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.skipSetupStep
)
router.post(
  '/:slug/setup/security-prompt-shown',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.markSecurityPromptShown
)

// Invitation management
router.post(
  '/:slug/invitations',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.createInvitation
)
router.get(
  '/:slug/invitations',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.listInvitations
)
router.delete(
  '/:slug/invitations/:invitationId',
  authenticateToken,
  requireOrganization,
  requireOrgAdmin,
  OrganizationController.revokeInvitation
)

export default router
