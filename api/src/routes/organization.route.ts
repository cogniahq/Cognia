import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  requireOrgViewer,
} from '../middleware/organization.middleware'
import { enforceIpAllowlist } from '../middleware/ip-allowlist.middleware'
import { enforceSessionTimeout } from '../middleware/session-timeout.middleware'
import { enforce2FARequirement } from '../middleware/require-2fa.middleware'
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
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.getOrganization
)
router.put(
  '/:slug',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.updateOrganization
)
router.delete(
  '/:slug',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.deleteOrganization
)

// Member management
router.post(
  '/:slug/members',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.addMember
)
router.get(
  '/:slug/members',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.listMembers
)
router.put(
  '/:slug/members/:memberId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.updateMember
)
router.delete(
  '/:slug/members/:memberId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.removeMember
)

// Memory endpoints (for mesh visualization)
router.get(
  '/:slug/memories',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.getMemories
)
router.get(
  '/:slug/memories/count',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.getMemoryCount
)
router.get(
  '/:slug/mesh',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.getMesh
)

// Enterprise setup endpoints
router.put(
  '/:slug/profile',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.updateProfile
)
router.put(
  '/:slug/billing',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.updateBilling
)
// Security endpoint bypasses IP allowlist and session timeout so admins can fix lockouts
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
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgViewer,
  OrganizationController.getSetupProgress
)
router.post(
  '/:slug/setup/skip',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.skipSetupStep
)
router.post(
  '/:slug/setup/security-prompt-shown',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.markSecurityPromptShown
)

// Invitation management
router.post(
  '/:slug/invitations',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.createInvitation
)
router.get(
  '/:slug/invitations',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.listInvitations
)
router.delete(
  '/:slug/invitations/:invitationId',
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
  requireOrgAdmin,
  OrganizationController.revokeInvitation
)

export default router
