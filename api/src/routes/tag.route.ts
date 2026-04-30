import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import {
  createTag,
  listTags,
  deleteTag,
  attachTag,
  detachTag,
} from '../services/memory/tag.service'

const router = Router()

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const orgId = req.query.organizationId as string | undefined
  const out = await listTags({ userId: orgId ? undefined : req.user.id, orgId })
  res.json({ success: true, data: out })
})

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await createTag(
      req.body?.organizationId ? { orgId: req.body.organizationId } : { userId: req.user.id },
      req.body?.name,
      req.body?.color
    )
    res.status(201).json({ success: true, data: out })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.delete('/:tagId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await deleteTag(req.params.tagId, {
      userId: req.user.id,
      orgId: req.query.organizationId as string | undefined,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

router.post('/:tagId/attach', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await attachTag(req.body?.memoryId, req.user.id, req.params.tagId)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.post('/:tagId/detach', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await detachTag(req.body?.memoryId, req.user.id, req.params.tagId)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

export default router
