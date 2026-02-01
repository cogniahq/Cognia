import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { OrganizationController } from '../controller/organization/organization.controller'

const router = Router()

// Public invitation endpoints (authenticated but not requiring org membership)
router.get('/:token', authenticateToken, OrganizationController.getInvitationByToken)
router.post('/:token/accept', authenticateToken, OrganizationController.acceptInvitation)

export default router
