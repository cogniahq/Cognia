import { Router } from 'express'
import { DataController } from '../controller/data/data.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { exportRateLimiter } from '../middleware/rate-limit.middleware'

const router = Router()

router.get('/', authenticateToken, exportRateLimiter, DataController.exportUserData)
router.post('/', authenticateToken, exportRateLimiter, DataController.importUserData)

export default router
