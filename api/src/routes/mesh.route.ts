import { Router } from 'express'
import { MeshMemoryController } from '../controller/mesh/mesh-memory.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/memories', authenticateToken, MeshMemoryController.upsertMemories)
router.get('/memories/query', authenticateToken, MeshMemoryController.queryMemories)

export default router
