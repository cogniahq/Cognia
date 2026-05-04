import { Router, Response } from 'express'
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'

const router = Router()

/**
 * GET /api/extension/destinations
 *
 * Returns the set of capture destinations the current user can choose from in
 * the browser extension's destination picker:
 *  - Personal vault (always available)
 *  - Each org the user is an active member of, with that org's workspaces
 *  - The user's saved default destination
 *
 * Shape is intentionally minimal — the popup is a small bundle and we don't
 * want to push permission/integration data into it.
 */
router.get('/destinations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const [memberships, user] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { user_id: userId, deactivated_at: null },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              slug: true,
              name: true,
              workspaces: {
                select: { id: true, name: true, slug: true },
                orderBy: { name: 'asc' },
              },
            },
          },
        },
        orderBy: { organization: { name: 'asc' } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          default_capture_organization_id: true,
          default_capture_workspace_id: true,
        },
      }),
    ])

    const organizations = memberships.map(m => ({
      id: m.organization.id,
      slug: m.organization.slug,
      name: m.organization.name,
      role: m.role,
      workspaces: m.organization.workspaces,
    }))

    res.status(200).json({
      success: true,
      data: {
        personal: true,
        organizations,
        default: {
          organizationId: user?.default_capture_organization_id ?? null,
          workspaceId: user?.default_capture_workspace_id ?? null,
        },
      },
    })
  } catch (error) {
    logger.error('Error listing extension destinations:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list destinations',
      })
    }
  }
})

export default router
