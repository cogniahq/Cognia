import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import {
  postComment,
  listComments,
  editComment,
  deleteComment,
} from '../services/memory/comment.service'

const router = Router()

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const memoryId = req.query.memoryId as string
  if (!memoryId) return res.status(400).json({ message: 'memoryId required' })
  try {
    const out = await listComments(memoryId, req.user.id)
    res.json({ success: true, data: out })
  } catch (err) {
    res.status(403).json({ success: false, message: (err as Error).message })
  }
})

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await postComment({
      memoryId: req.body?.memoryId,
      authorUserId: req.user.id,
      bodyMd: req.body?.bodyMd,
      parentId: req.body?.parentId,
    })
    res.status(201).json({ success: true, data: out })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await editComment(req.params.id, req.user.id, req.body?.bodyMd ?? '')
    res.json({ success: true, data: out })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await deleteComment(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

export default router
