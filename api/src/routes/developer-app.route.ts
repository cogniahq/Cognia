import { Router } from 'express'
import { DeveloperAppController } from '../controller/developer-app/developer-app.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/', authenticateToken, DeveloperAppController.createDeveloperApp)
router.get('/', authenticateToken, DeveloperAppController.listDeveloperApps)
router.get('/:id', authenticateToken, DeveloperAppController.getDeveloperApp)
router.patch('/:id', authenticateToken, DeveloperAppController.updateDeveloperApp)
router.delete('/:id', authenticateToken, DeveloperAppController.deleteDeveloperApp)

export default router
