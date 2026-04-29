import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma.lib'
import { purgeDemoData } from '../services/onboarding/sample-workspace-seeder.service'
import { logger } from '../utils/core/logger.util'

const router = Router()

router.post(
  '/dismiss-demo',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    try {
      const out = await purgeDemoData(req.user.id)
      return res.json({ success: true, ...out })
    } catch (error) {
      logger.error('[onboarding] dismiss-demo error:', error)
      return res.status(500).json({ message: 'Failed to dismiss demo' })
    }
  }
)

router.post(
  '/tour-completed',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { tour_completed_at: new Date() },
      })
      return res.json({ success: true })
    } catch (error) {
      logger.error('[onboarding] tour-completed error:', error)
      return res.status(500).json({ message: 'Failed to mark tour completed' })
    }
  }
)

router.get('/state', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        tour_completed_at: true,
        demo_dismissed_at: true,
        email_verified_at: true,
      },
    })
    const demoCount = await prisma.memory.count({
      where: { user_id: req.user.id, source_type: 'DEMO' },
    })
    return res.json({
      success: true,
      data: {
        tourCompleted: !!user?.tour_completed_at,
        demoDismissed: !!user?.demo_dismissed_at,
        emailVerified: !!user?.email_verified_at,
        demoMemoryCount: demoCount,
      },
    })
  } catch (error) {
    logger.error('[onboarding] state error:', error)
    return res.status(500).json({ message: 'Failed to load onboarding state' })
  }
})

export default router
