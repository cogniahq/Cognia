import { Router, Response, Request } from 'express'
import { authenticateApiKey, requireScope, ApiKeyRequest } from '../middleware/api-key.middleware'
import { createRateLimiter } from '../middleware/rate-limit.middleware'
import {
  listMemories,
  updateMemory,
  softDeleteMemory,
} from '../services/memory/memory-crud.service'
import { unifiedSearchService } from '../services/search/unified-search.service'
import { prisma } from '../lib/prisma.lib'

const router = Router()
router.use(authenticateApiKey)

// Per-API-key rate limit
const apiKeyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100, // configurable per plan in future
  keyPrefix: 'ratelimit:apikey',
  keyExtractor: (req: Request) => `apikey:${(req as ApiKeyRequest).apiKey?.id ?? 'unknown'}`,
})
router.use(apiKeyRateLimiter)

// GET /v1/memories — paginated list
router.get(
  '/memories',
  requireScope('memories.read'),
  async (req: ApiKeyRequest, res: Response) => {
    const out = await listMemories({
      userId: req.apiKey!.userId,
      cursor: req.query.cursor as string | undefined,
      limit: Number(req.query.limit) || 50,
      q: req.query.q as string | undefined,
    })
    res.json({
      data: out.items.map(m => ({
        id: m.id,
        title: m.title,
        content: m.content,
        url: m.url,
        memory_type: m.memory_type,
        source: m.source,
        source_type: m.source_type,
        created_at: m.created_at,
      })),
      next_cursor: out.nextCursor,
    })
  }
)

// GET /v1/memories/:id
router.get(
  '/memories/:id',
  requireScope('memories.read'),
  async (req: ApiKeyRequest, res: Response) => {
    const m = await prisma.memory.findFirst({
      where: { id: req.params.id, user_id: req.apiKey!.userId, deleted_at: null },
    })
    if (!m) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ data: m })
  }
)

// PATCH /v1/memories/:id
router.patch(
  '/memories/:id',
  requireScope('memories.write'),
  async (req: ApiKeyRequest, res: Response) => {
    try {
      const updated = await updateMemory(req.apiKey!.userId, req.params.id, req.body ?? {})
      res.json({ data: updated })
    } catch (err) {
      res.status(400).json({ error: 'bad_request', message: (err as Error).message })
    }
  }
)

// DELETE /v1/memories/:id
router.delete(
  '/memories/:id',
  requireScope('memories.write'),
  async (req: ApiKeyRequest, res: Response) => {
    try {
      await softDeleteMemory(req.apiKey!.userId, req.params.id)
      res.status(204).end()
    } catch (err) {
      res.status(404).json({ error: 'not_found', message: (err as Error).message })
    }
  }
)

// POST /v1/search — hybrid (dense + sparse) retrieval with cross-encoder rerank
router.post('/search', requireScope('search'), async (req: ApiKeyRequest, res: Response) => {
  const q = req.body?.query as string
  const limit = Math.min(Number(req.body?.limit ?? 10), 50)
  if (!q) {
    res.status(400).json({ error: 'bad_request', message: 'query required' })
    return
  }

  const organizationId = req.apiKey!.organizationId
  if (organizationId) {
    const out = await unifiedSearchService.search({
      organizationId,
      query: q,
      limit,
      includeAnswer: false,
      userId: req.apiKey!.userId,
    })
    res.json({
      data: out.results.map(result => ({
        id: result.memoryId,
        title: result.title,
        snippet: result.contentPreview,
        url: result.url,
        score: result.score,
        document: result.documentName
          ? {
              id: result.documentId,
              name: result.documentName,
              page_number: result.pageNumber,
            }
          : undefined,
      })),
    })
    return
  }

  // Personal API key (no org): fall back to user-scoped substring match.
  const items = await prisma.memory.findMany({
    where: {
      user_id: req.apiKey!.userId,
      deleted_at: null,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { created_at: 'desc' },
  })
  res.json({
    data: items.map(m => ({
      id: m.id,
      title: m.title,
      snippet: m.content?.slice(0, 200),
      url: m.url,
    })),
  })
})

export default router
