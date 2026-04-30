import { Router, Response } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { prisma } from '../lib/prisma.lib'
import { auditLogService } from '../services/core/audit-log.service'

const router = Router()

const VALID_SCOPES = ['memories.read', 'memories.write', 'search']

router.use(authenticateToken)

router.post(
  '/',
  requirePermission('api_key.create', { orgFromBody: 'organizationId', allowPersonal: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }
    const name = (req.body?.name as string) ?? 'Untitled key'
    const scopes: string[] = Array.isArray(req.body?.scopes)
      ? (req.body.scopes as string[])
      : ['memories.read', 'search']
    const orgId = (req.body?.organizationId as string | undefined) ?? null
    const invalid = scopes.filter(s => !VALID_SCOPES.includes(s))
    if (invalid.length) {
      res.status(400).json({ message: `Invalid scopes: ${invalid.join(',')}` })
      return
    }

    const raw = `ck_live_${randomBytes(28).toString('base64url')}`
    const hash = createHash('sha256').update(raw).digest('hex')
    const prefix = raw.slice(0, 16)
    const key = await prisma.apiKey.create({
      data: {
        user_id: req.user.id,
        organization_id: orgId,
        name,
        prefix,
        key_hash: hash,
        scopes,
      },
    })
    await auditLogService
      .logEvent({
        userId: req.user.id,
        eventType: 'api_key_created',
        eventCategory: 'api',
        action: 'create',
        metadata: { keyId: key.id, scopes, orgId },
      })
      .catch(() => {})
    res.status(201).json({
      success: true,
      data: {
        id: key.id,
        prefix,
        name: key.name,
        scopes: key.scopes,
        created_at: key.created_at,
        token: raw, // returned ONCE
      },
    })
  }
)

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  const keys = await prisma.apiKey.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      prefix: true,
      name: true,
      scopes: true,
      organization_id: true,
      created_at: true,
      last_used_at: true,
      revoked_at: true,
    },
  })
  res.json({ success: true, data: keys })
})

router.delete(
  '/:id',
  requirePermission('api_key.revoke', { allowPersonal: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }
    const key = await prisma.apiKey.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    })
    if (!key) {
      res.status(404).json({ message: 'Not found' })
      return
    }
    await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { revoked_at: new Date() },
    })
    await auditLogService
      .logEvent({
        userId: req.user.id,
        eventType: 'api_key_revoked',
        eventCategory: 'api',
        action: 'revoke',
        metadata: { keyId: req.params.id },
      })
      .catch(() => {})
    res.json({ success: true })
  }
)

export default router
