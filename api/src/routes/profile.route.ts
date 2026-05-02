import { Router } from 'express'
import { ProfileController } from '../controller/profile/profile.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticateToken, ProfileController.getProfile)
router.post('/refresh', authenticateToken, ProfileController.refreshProfile)
router.get('/context', authenticateToken, ProfileController.getProfileContext)
router.get(
  '/capture-destination',
  authenticateToken,
  ProfileController.getCaptureDestination
)
router.put(
  '/capture-destination',
  authenticateToken,
  ProfileController.updateCaptureDestination
)

export default router
