import { Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { profileUpdateService } from '../../services/profile/profile-update.service'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

export class ProfileController {
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const profile = await profileUpdateService.getUserProfile(userId)

      if (!profile) {
        if (res.headersSent) {
          logger.warn('Response already sent, skipping profile get response')
          return
        }
        return res.status(200).json({
          success: true,
          data: {
            profile: null,
            message: 'Profile not yet created. Process some content to generate a profile.',
          },
        })
      }

      if (res.headersSent) {
        logger.warn('Response already sent, skipping profile get response')
        return
      }

      res.status(200).json({
        success: true,
        data: {
          profile: {
            id: profile.id,
            user_id: profile.user_id,
            static_profile: {
              json: profile.static_profile_json,
              text: profile.static_profile_text,
            },
            dynamic_profile: {
              json: profile.dynamic_profile_json,
              text: profile.dynamic_profile_text,
            },
            last_updated: profile.last_updated,
            last_memory_analyzed: profile.last_memory_analyzed,
            version: profile.version,
          },
        },
      })
    } catch (error) {
      logger.error('Error getting profile:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get profile',
        })
      } else {
        logger.warn('Response already sent, cannot send error response')
      }
    }
  }

  static async refreshProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      logger.log('[profile/refresh] starting', {
        ts: new Date().toISOString(),
        userId,
      })

      let profile
      try {
        profile = await profileUpdateService.updateUserProfile(userId, true)
      } catch (error) {
        logger.error('Error refreshing profile, retrying once:', error)

        try {
          profile = await profileUpdateService.updateUserProfile(userId, true)
        } catch (retryError) {
          logger.error('Error refreshing profile on retry:', retryError)
          throw retryError
        }
      }

      logger.log('[profile/refresh] completed', {
        ts: new Date().toISOString(),
        userId,
        version: profile.version,
      })

      if (res.headersSent) {
        logger.warn('Response already sent, skipping profile refresh response')
        return
      }

      res.status(200).json({
        success: true,
        message: 'Profile refreshed successfully',
        data: {
          profile: {
            id: profile.id,
            user_id: profile.user_id,
            static_profile: {
              json: profile.static_profile_json,
              text: profile.static_profile_text,
            },
            dynamic_profile: {
              json: profile.dynamic_profile_json,
              text: profile.dynamic_profile_text,
            },
            last_updated: profile.last_updated,
            last_memory_analyzed: profile.last_memory_analyzed,
            version: profile.version,
          },
        },
      })
    } catch (error) {
      logger.error('Error refreshing profile:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to refresh profile',
        })
      } else {
        logger.warn('Response already sent, cannot send error response')
      }
    }
  }

  /**
   * Returns the user's stored default capture destination (used by the browser
   * extension and any other client that captures content). null/null = personal
   * vault. Validation of the saved IDs against current membership happens on
   * write; on read we return what we stored.
   */
  static async getCaptureDestination(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          default_capture_organization_id: true,
          default_capture_workspace_id: true,
        },
      })
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' })
      }
      res.status(200).json({
        success: true,
        data: {
          organizationId: user.default_capture_organization_id,
          workspaceId: user.default_capture_workspace_id,
        },
      })
    } catch (error) {
      logger.error('Error getting capture destination:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get capture destination',
        })
      }
    }
  }

  /**
   * Updates the user's default capture destination. Body shape:
   *   { organizationId: string | null, workspaceId: string | null }
   * Personal vault is `{ null, null }`. If `organizationId` is set, the user
   * must be an active org member; if `workspaceId` is set, `organizationId`
   * must also be set and the workspace must belong to that org.
   */
  static async updateCaptureDestination(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const body = req.body ?? {}
      const organizationId: string | null =
        body.organizationId === undefined ? null : body.organizationId
      const workspaceId: string | null = body.workspaceId === undefined ? null : body.workspaceId

      if (organizationId !== null && typeof organizationId !== 'string') {
        return res
          .status(400)
          .json({ success: false, message: 'organizationId must be a string or null' })
      }
      if (workspaceId !== null && typeof workspaceId !== 'string') {
        return res
          .status(400)
          .json({ success: false, message: 'workspaceId must be a string or null' })
      }
      if (workspaceId && !organizationId) {
        return res
          .status(400)
          .json({ success: false, message: 'workspaceId requires organizationId' })
      }

      if (organizationId) {
        const membership = await prisma.organizationMember.findFirst({
          where: { user_id: userId, organization_id: organizationId, deactivated_at: null },
        })
        if (!membership) {
          return res
            .status(403)
            .json({ success: false, message: 'Not an active member of that organization' })
        }
      }

      if (workspaceId && organizationId) {
        const workspace = await prisma.workspace.findFirst({
          where: { id: workspaceId, organization_id: organizationId },
        })
        if (!workspace) {
          return res
            .status(400)
            .json({ success: false, message: 'Workspace does not belong to organization' })
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          default_capture_organization_id: organizationId,
          default_capture_workspace_id: workspaceId,
        },
      })

      res.status(200).json({
        success: true,
        data: { organizationId, workspaceId },
      })
    } catch (error) {
      logger.error('Error updating capture destination:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update capture destination',
        })
      }
    }
  }

  static async getProfileContext(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const context = await profileUpdateService.getProfileContext(userId)

      if (res.headersSent) {
        logger.warn('Response already sent, skipping profile context response')
        return
      }

      res.status(200).json({
        success: true,
        data: {
          context: context || '',
        },
      })
    } catch (error) {
      logger.error('Error getting profile context:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get profile context',
        })
      } else {
        logger.warn('Response already sent, cannot send error response')
      }
    }
  }
}
