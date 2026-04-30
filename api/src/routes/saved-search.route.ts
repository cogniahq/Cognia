import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import {
  createSavedSearch,
  listSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
} from '../services/memory/saved-search.service'

const router = Router()

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const out = await listSavedSearches(req.user.id, req.query.organizationId as string | undefined)
  res.json({ success: true, data: out })
})

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await createSavedSearch({
      userId: req.user.id,
      organizationId: req.body?.organizationId,
      name: req.body?.name,
      query: req.body?.query,
      filters: req.body?.filters,
      alertEnabled: req.body?.alertEnabled,
      alertFrequency: req.body?.alertFrequency,
    })
    res.status(201).json({ success: true, data: out })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await updateSavedSearch(req.params.id, req.user.id, req.body ?? {})
    res.json({ success: true, data: out })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await deleteSavedSearch(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

export default router
