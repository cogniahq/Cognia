import { Router } from 'express'
import { BriefingController } from '../controller/briefing/briefing.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticateToken, BriefingController.listBriefings)
router.get('/latest', authenticateToken, BriefingController.getLatestBriefings)
router.get('/unread-count', authenticateToken, BriefingController.getUnreadCount)
router.get('/preferences', authenticateToken, BriefingController.getPreferences)
router.put('/preferences', authenticateToken, BriefingController.updatePreferences)
router.post('/generate', authenticateToken, BriefingController.generateNow)
router.get('/:id', authenticateToken, BriefingController.getBriefing)
router.post('/:id/read', authenticateToken, BriefingController.markAsRead)

export default router
