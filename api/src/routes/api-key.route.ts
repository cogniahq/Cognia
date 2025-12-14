import { Router } from 'express'
import { ApiKeyController } from '../controller/api-key/api-key.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/:app_id/keys', authenticateToken, ApiKeyController.createApiKey)
router.get('/:app_id/keys', authenticateToken, ApiKeyController.listApiKeys)
router.get('/:app_id/keys/:key_id', authenticateToken, ApiKeyController.getApiKey)
router.patch('/:app_id/keys/:key_id', authenticateToken, ApiKeyController.updateApiKey)
router.post('/:app_id/keys/:key_id/revoke', authenticateToken, ApiKeyController.revokeApiKey)
router.get('/:app_id/keys/:key_id/usage', authenticateToken, ApiKeyController.getApiKeyUsage)

export default router

