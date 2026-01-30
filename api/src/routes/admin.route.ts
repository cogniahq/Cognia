import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { AdminController } from '../controller/admin/admin.controller'

const router = Router()

// All admin routes require authentication and admin role
router.get('/stats', authenticateToken, requireAdmin, AdminController.getStats)

export default router
