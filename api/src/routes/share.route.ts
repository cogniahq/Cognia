import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import {
  createShare,
  listSharesForMemory,
  revokeShare,
  getMemoryByShareLink,
} from '../services/memory/share.service'

const router = Router()

router.post(
  '/',
  authenticateToken,
  requirePermission('memory.share', { allowPersonal: true }),
  async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    try {
      const out = await createShare({
        memoryId: req.body?.memoryId,
        sharerUserId: req.user.id,
        recipientType: req.body?.recipientType,
        recipientUserId: req.body?.recipientUserId,
        recipientOrgId: req.body?.recipientOrgId,
        permission: req.body?.permission,
        expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : undefined,
      })
      res.status(201).json({ success: true, data: out })
    } catch (err) {
      res.status(400).json({ success: false, message: (err as Error).message })
    }
  }
)

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const memoryId = req.query.memoryId as string
  if (!memoryId) return res.status(400).json({ message: 'memoryId required' })
  const out = await listSharesForMemory(memoryId, req.user.id)
  res.json({ success: true, data: out })
})

router.delete(
  '/:shareId',
  authenticateToken,
  requirePermission('memory.share', { allowPersonal: true }),
  async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    try {
      await revokeShare(req.params.shareId, req.user.id)
      res.json({ success: true })
    } catch (err) {
      res.status(404).json({ success: false, message: (err as Error).message })
    }
  }
)

// Public link consumption
router.get('/link/:token', async (req, res) => {
  const out = await getMemoryByShareLink(req.params.token)
  if (!out) return res.status(404).json({ success: false, message: 'Share not found or expired' })
  res.json({ success: true, data: out })
})

export default router
