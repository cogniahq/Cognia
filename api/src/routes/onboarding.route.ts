import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma.lib'
import { purgeDemoData } from '../services/onboarding/sample-workspace-seeder.service'
import { organizationService } from '../services/organization/organization.service'
import { logger } from '../utils/core/logger.util'

const router = Router()

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'workspace'
  )
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base
  let attempt = 1
  // Try base, base-2, base-3, ...; cap at 25 attempts to avoid pathological
  // loops if the schema invariant breaks somehow.
  while (attempt < 25) {
    const exists = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    attempt += 1
    candidate = `${base}-${attempt}`
  }
  // Fall back to a random suffix as last resort.
  return `${base}-${Date.now().toString(36)}`
}

/**
 * Onboarding wall — create the user's first workspace.
 *
 * Reject if the caller already has any active OrganizationMember row; the
 * regular `POST /api/organizations` endpoint should be used after that to
 * create additional team workspaces.
 */
router.post('/workspace', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const name: string = (req.body?.name ?? '').toString().trim()
  if (!name) {
    return res.status(400).json({ message: 'name is required' })
  }
  try {
    const existing = await prisma.organizationMember.findFirst({
      where: { user_id: req.user.id, deactivated_at: null },
      select: { id: true },
    })
    if (existing) {
      return res
        .status(409)
        .json({ message: 'User already has a workspace; use /api/organizations instead' })
    }
    const requestedSlug =
      typeof req.body?.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(name)
    const slug = await uniqueSlug(requestedSlug)
    const org = await organizationService.createOrganization(req.user.id, {
      name,
      slug,
    })
    return res.status(201).json({
      success: true,
      data: { organization: { id: org.id, name: org.name, slug: org.slug } },
    })
  } catch (error) {
    logger.error('[onboarding] workspace error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create workspace' })
  }
})

/**
 * Onboarding wall — accept an invite by raw token. Mirrors
 * /api/invitations/:token/accept but is reachable from /api/onboarding/* so
 * the require-org-membership wall doesn't blackhole the request.
 */
router.post(
  '/accept-invite',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    const code: string = (req.body?.code ?? '').toString().trim()
    if (!code) return res.status(400).json({ message: 'code is required' })
    try {
      const org = await organizationService.acceptInvitation(code, req.user.id)
      return res.json({
        success: true,
        data: { organization: { id: org.id, name: org.name, slug: org.slug } },
      })
    } catch (error) {
      const message = (error as Error).message || 'Failed to accept invitation'
      logger.error('[onboarding] accept-invite error:', error)
      return res.status(400).json({ success: false, message })
    }
  }
)

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
