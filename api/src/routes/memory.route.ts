import { Router } from 'express'
import { MemoryController } from '../controller/memory/memory.controller'
import { MemoryMeshController } from '../controller/memory/memory-mesh.controller'
import { DataController } from '../controller/data/data.controller'
import { AnalyticsController } from '../controller/analytics/analytics.controller'
import { ContentController } from '../controller/content/content.controller'
import { SearchController } from '../controller/search/search.controller'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware'
import {
  listMemories,
  updateMemory,
  softDeleteMemory,
  bulkSoftDelete,
  restoreMemory,
  hardDeleteMemory,
} from '../services/memory/memory-crud.service'

const router = Router()

router.post('/process', authenticateToken, ContentController.submitContent)
router.get('/user/count', authenticateToken, MemoryController.getUserMemoryCount)
router.get('/user/recent', authenticateToken, MemoryController.getRecentMemories)
router.get('/search', authenticateToken, SearchController.searchMemories)
router.get('/analytics', authenticateToken, AnalyticsController.getAnalytics)
router.get('/mesh', authenticateToken, MemoryMeshController.getMemoryMesh)
router.get('/relations/:memoryId', authenticateToken, MemoryMeshController.getMemoryWithRelations)
router.get('/cluster/:memoryId', authenticateToken, MemoryMeshController.getMemoryCluster)
router.get('/search-embeddings', authenticateToken, SearchController.searchMemoriesWithEmbeddings)
router.get('/search-hybrid', authenticateToken, SearchController.searchMemoriesHybrid)
router.post('/process-mesh/:memoryId', authenticateToken, MemoryMeshController.processMemoryForMesh)
router.get('/snapshots', authenticateToken, DataController.getMemorySnapshots)
router.get('/snapshot/:snapshotId', authenticateToken, DataController.getMemorySnapshot)
router.post('/backfill-snapshots', authenticateToken, DataController.backfillMemorySnapshots)
router.get('/health', MemoryController.healthCheck)
router.get('/debug', authenticateToken, MemoryController.debugMemories)

// Phase 4 Slice A: Memory CRUD with soft-delete + cursor pagination
router.get('/v2', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const out = await listMemories({
    userId: req.user.id,
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    includeDeleted: req.query.includeDeleted === 'true',
    onlyDeleted: req.query.onlyDeleted === 'true',
    q: req.query.q as string | undefined,
  })
  res.json({ success: true, data: out.items, nextCursor: out.nextCursor })
})

router.post('/bulk-delete', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  if (ids.length === 0) return res.status(400).json({ message: 'ids required' })
  if (ids.length > 1000) return res.status(400).json({ message: 'Too many ids (max 1000)' })
  const out = await bulkSoftDelete(req.user.id, ids)
  res.json({ success: true, ...out })
})

router.post('/:id/restore', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await restoreMemory(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const updated = await updateMemory(req.user.id, req.params.id, req.body ?? {})
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    if (req.query.hard === 'true') await hardDeleteMemory(req.user.id, req.params.id)
    else await softDeleteMemory(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

router.delete('/:memoryId', authenticateToken, MemoryController.deleteMemory)
router.post('/:memoryId/redact', authenticateToken, MemoryController.redactMemory)
router.post('/redact-domain', authenticateToken, MemoryController.redactDomainMemories)

export default router
