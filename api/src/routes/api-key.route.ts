import { Router } from 'express'
import { ApiKeyController } from '../controller/api-key/api-key.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/', authenticateToken, ApiKeyController.createApiKey)
router.get('/', authenticateToken, ApiKeyController.listApiKeys)
router.get('/:id', authenticateToken, ApiKeyController.getApiKey)
router.patch('/:id', authenticateToken, ApiKeyController.updateApiKey)
router.delete('/:id', authenticateToken, ApiKeyController.revokeApiKey)
router.get('/:id/usage', authenticateToken, ApiKeyController.getApiKeyUsage)

export default router

