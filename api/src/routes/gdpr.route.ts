import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma.lib'
import {
  scheduleAccountDeletion,
  cancelAccountDeletion,
} from '../services/compliance/account-deletion.service'

const router = Router()

router.use(authenticateToken)

// POST /api/gdpr/delete-account — schedule deletion
router.post('/delete-account', async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await scheduleAccountDeletion(
      req.user.id,
      req.ip,
      req.get('user-agent') ?? undefined
    )
    res.json({ success: true, ...out })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.post('/cancel-deletion', async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    await cancelAccountDeletion(req.user.id)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

router.get('/delete-status', async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { deletion_scheduled_at: true, legal_hold_until: true },
  })
  res.json({
    success: true,
    data: {
      scheduledFor: u?.deletion_scheduled_at ?? null,
      underLegalHold: !!(u?.legal_hold_until && u.legal_hold_until > new Date()),
    },
  })
})

router.post('/consent', async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const consent = {
    cookies: !!req.body?.cookies,
    analytics: !!req.body?.analytics,
    marketing: !!req.body?.marketing,
    recordedAt: new Date().toISOString(),
    ipAddress: req.ip ?? null,
  }
  await prisma.user.update({
    where: { id: req.user.id },
    data: { consent: consent as never },
  })
  res.json({ success: true })
})

export default router
