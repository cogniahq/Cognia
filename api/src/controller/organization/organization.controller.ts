import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { OrganizationRequest } from '../../middleware/organization.middleware'
import { organizationService } from '../../services/organization/organization.service'
import { memoryMeshService } from '../../services/memory/memory-mesh.service'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'

export class OrganizationController {
  /**
   * Create a new organization
   * POST /api/organizations
   */
  static async createOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const { name, description, industry, teamSize } = req.body
      let { slug } = req.body

      if (!name) {
        return next(new AppError('Name is required', 400))
      }

      if (!industry) {
        return next(new AppError('Industry is required', 400))
      }

      if (!teamSize) {
        return next(new AppError('Team size is required', 400))
      }

      // Auto-generate slug from name if not provided
      if (!slug) {
        slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50)

        // Add random suffix to ensure uniqueness
        slug = `${slug}-${Date.now().toString(36)}`
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return next(new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400))
      }

      const organization = await organizationService.createOrganization(userId, {
        name,
        slug,
        description,
        industry,
        teamSize,
      })

      res.status(201).json({
        success: true,
        data: { organization },
      })
    } catch (error) {
      logger.error('[organization] Error creating organization', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })

      if (error instanceof Error && error.message.includes('already exists')) {
        return next(new AppError(error.message, 409))
      }

      next(new AppError('Failed to create organization', 500))
    }
  }

  /**
   * List user's organizations
   * GET /api/organizations/user/organizations
   */
  static async listOrganizations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const orgs = await organizationService.getUserOrganizations(userId)

      // Get user's role for each organization
      const organizations = orgs.map(org => {
        const userMembership = org.members.find(m => m.user_id === userId)
        return {
          ...org,
          userRole: userMembership?.role || 'VIEWER',
          memberCount: org.members.length,
        }
      })

      res.status(200).json({
        success: true,
        data: { organizations },
      })
    } catch (error) {
      logger.error('[organization] Error listing organizations', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      })
      next(new AppError('Failed to list organizations', 500))
    }
  }

  /**
   * Get organization details
   * GET /api/organizations/:slug
   */
  static async getOrganization(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.getOrganizationById(req.organization!.id)

      if (!org) {
        return next(new AppError('Organization not found', 404))
      }

      const organization = {
        ...org,
        userRole: req.organization!.userRole,
        memberCount: org.members.length,
      }

      res.status(200).json({
        success: true,
        data: { organization },
      })
    } catch (error) {
      logger.error('[organization] Error getting organization', {
        error: error instanceof Error ? error.message : String(error),
        slug: req.params.slug,
      })
      next(new AppError('Failed to get organization', 500))
    }
  }

  /**
   * Update organization
   * PUT /api/organizations/:slug
   */
  static async updateOrganization(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { name, slug } = req.body

      if (slug && !/^[a-z0-9-]+$/.test(slug)) {
        return next(new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400))
      }

      const organization = await organizationService.updateOrganization(req.organization!.id, {
        name,
        slug,
      })

      res.status(200).json({
        success: true,
        data: organization,
      })
    } catch (error) {
      logger.error('[organization] Error updating organization', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })

      if (error instanceof Error && error.message.includes('already exists')) {
        return next(new AppError(error.message, 409))
      }

      next(new AppError('Failed to update organization', 500))
    }
  }

  /**
   * Delete organization
   * DELETE /api/organizations/:slug
   */
  static async deleteOrganization(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      await organizationService.deleteOrganization(req.organization!.id)

      res.status(200).json({
        success: true,
        message: 'Organization deleted',
      })
    } catch (error) {
      logger.error('[organization] Error deleting organization', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to delete organization', 500))
    }
  }

  /**
   * Add member to organization
   * POST /api/organizations/:slug/members
   * Accepts either { userId, role } or { email, role }
   */
  static async addMember(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { userId, email, role } = req.body

      if (!userId && !email) {
        return next(new AppError('Either userId or email is required', 400))
      }

      let member

      if (email) {
        // Add by email
        member = await organizationService.addMemberByEmail(
          req.organization!.id,
          email,
          role
        )
      } else {
        // Add by userId
        member = await organizationService.addMember(req.organization!.id, {
          userId,
          role,
        })
      }

      res.status(201).json({
        success: true,
        data: { member },
      })
    } catch (error) {
      logger.error('[organization] Error adding member', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })

      if (error instanceof Error) {
        if (error.message.includes('already a member')) {
          return next(new AppError(error.message, 409))
        }
        if (error.message.includes('User not found')) {
          return next(new AppError(error.message, 404))
        }
      }

      next(new AppError('Failed to add member', 500))
    }
  }

  /**
   * List organization members
   * GET /api/organizations/:slug/members
   */
  static async listMembers(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const members = await organizationService.getMembers(req.organization!.id)

      res.status(200).json({
        success: true,
        data: { members },
      })
    } catch (error) {
      logger.error('[organization] Error listing members', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to list members', 500))
    }
  }

  /**
   * Update member role
   * PUT /api/organizations/:slug/members/:memberId
   */
  static async updateMember(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params
      const { role } = req.body

      if (!role) {
        return next(new AppError('role is required', 400))
      }

      const member = await organizationService.updateMemberRole(memberId, { role })

      res.status(200).json({
        success: true,
        data: member,
      })
    } catch (error) {
      logger.error('[organization] Error updating member', {
        error: error instanceof Error ? error.message : String(error),
        memberId: req.params.memberId,
      })
      next(new AppError('Failed to update member', 500))
    }
  }

  /**
   * Remove member from organization
   * DELETE /api/organizations/:slug/members/:memberId
   */
  static async removeMember(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params

      await organizationService.removeMember(memberId)

      res.status(200).json({
        success: true,
        message: 'Member removed',
      })
    } catch (error) {
      logger.error('[organization] Error removing member', {
        error: error instanceof Error ? error.message : String(error),
        memberId: req.params.memberId,
      })

      if (error instanceof Error && error.message.includes('last admin')) {
        return next(new AppError(error.message, 400))
      }

      next(new AppError('Failed to remove member', 500))
    }
  }

  /**
   * Get organization memories for the mesh visualization
   * GET /api/organizations/:slug/memories
   */
  static async getMemories(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10000

      const memories = await organizationService.getOrganizationMemories(
        req.organization!.id,
        limit
      )

      res.status(200).json({
        success: true,
        data: { memories },
      })
    } catch (error) {
      logger.error('[organization] Error getting memories', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to get organization memories', 500))
    }
  }

  /**
   * Get organization memory count
   * GET /api/organizations/:slug/memories/count
   */
  static async getMemoryCount(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const count = await organizationService.getOrganizationMemoryCount(req.organization!.id)

      res.status(200).json({
        success: true,
        data: { count },
      })
    } catch (error) {
      logger.error('[organization] Error getting memory count', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to get memory count', 500))
    }
  }

  /**
   * Get organization memory mesh for visualization
   * GET /api/organizations/:slug/mesh
   */
  static async getMesh(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10000
      const threshold = parseFloat(req.query.threshold as string) || 0.3

      // Get memory IDs for this organization (from document chunks)
      const memoryIds = await organizationService.getOrganizationMemoryIds(req.organization!.id, limit)

      if (memoryIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: { nodes: [], edges: [] },
        })
      }

      // Build mesh from those memory IDs (includes DOCUMENT and INTEGRATION source types)
      const mesh = await memoryMeshService.getMemoryMeshForMemoryIds(
        memoryIds,
        limit,
        threshold,
        {
          organizationId: req.organization!.id,
        }
      )

      res.status(200).json({
        success: true,
        data: mesh,
      })
    } catch (error) {
      logger.error('[organization] Error getting mesh', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to get organization mesh', 500))
    }
  }

  // ==========================================
  // Enterprise Setup Endpoints
  // ==========================================

  /**
   * Update organization profile
   * PUT /api/organizations/:slug/profile
   */
  static async updateProfile(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { slug } = req.body

      if (slug && !/^[a-z0-9-]+$/.test(slug)) {
        return next(new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400))
      }

      const organization = await organizationService.updateProfile(req.organization!.id, req.body)

      res.status(200).json({
        success: true,
        data: { organization },
      })
    } catch (error) {
      logger.error('[organization] Error updating profile', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })

      if (error instanceof Error && error.message.includes('already exists')) {
        return next(new AppError(error.message, 409))
      }

      next(new AppError('Failed to update profile', 500))
    }
  }

  /**
   * Update organization billing settings
   * PUT /api/organizations/:slug/billing
   */
  static async updateBilling(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const organization = await organizationService.updateBilling(req.organization!.id, req.body)

      res.status(200).json({
        success: true,
        data: { organization },
      })
    } catch (error) {
      logger.error('[organization] Error updating billing', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to update billing', 500))
    }
  }

  /**
   * Update organization security settings
   * PUT /api/organizations/:slug/security
   */
  static async updateSecurity(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const organization = await organizationService.updateSecurity(req.organization!.id, req.body)

      res.status(200).json({
        success: true,
        data: { organization },
      })
    } catch (error) {
      logger.error('[organization] Error updating security', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to update security', 500))
    }
  }

  /**
   * Get setup progress
   * GET /api/organizations/:slug/setup
   */
  static async getSetupProgress(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const progress = await organizationService.getSetupProgress(req.organization!.id)

      res.status(200).json({
        success: true,
        data: { progress },
      })
    } catch (error) {
      logger.error('[organization] Error getting setup progress', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to get setup progress', 500))
    }
  }

  /**
   * Skip a setup step
   * POST /api/organizations/:slug/setup/skip
   */
  static async skipSetupStep(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { step } = req.body

      if (!step) {
        return next(new AppError('Step is required', 400))
      }

      await organizationService.skipSetupStep(req.organization!.id, step)

      res.status(200).json({
        success: true,
        message: 'Step skipped',
      })
    } catch (error) {
      logger.error('[organization] Error skipping setup step', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to skip step', 500))
    }
  }

  /**
   * Mark security prompt as shown
   * POST /api/organizations/:slug/setup/security-prompt-shown
   */
  static async markSecurityPromptShown(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      await organizationService.markSecurityPromptShown(req.organization!.id)

      res.status(200).json({
        success: true,
        message: 'Security prompt marked as shown',
      })
    } catch (error) {
      logger.error('[organization] Error marking security prompt', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to mark security prompt', 500))
    }
  }

  // ==========================================
  // Invitation Endpoints
  // ==========================================

  /**
   * Create invitation(s)
   * POST /api/organizations/:slug/invitations
   */
  static async createInvitation(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { emails, role } = req.body
      const inviterId = req.user!.id

      if (!emails || (Array.isArray(emails) && emails.length === 0)) {
        return next(new AppError('At least one email is required', 400))
      }

      const emailList = Array.isArray(emails) ? emails : [emails]
      const invitations = []
      const errors = []

      for (const email of emailList) {
        try {
          const invitation = await organizationService.createInvitation(
            req.organization!.id,
            inviterId,
            { email, role }
          )
          invitations.push(invitation)
        } catch (error) {
          errors.push({
            email,
            error: error instanceof Error ? error.message : 'Failed to create invitation',
          })
        }
      }

      res.status(201).json({
        success: true,
        data: { invitations, errors },
      })
    } catch (error) {
      logger.error('[organization] Error creating invitations', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to create invitations', 500))
    }
  }

  /**
   * List pending invitations
   * GET /api/organizations/:slug/invitations
   */
  static async listInvitations(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const invitations = await organizationService.getInvitations(req.organization!.id)

      res.status(200).json({
        success: true,
        data: { invitations },
      })
    } catch (error) {
      logger.error('[organization] Error listing invitations', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Failed to list invitations', 500))
    }
  }

  /**
   * Revoke invitation
   * DELETE /api/organizations/:slug/invitations/:invitationId
   */
  static async revokeInvitation(req: OrganizationRequest, res: Response, next: NextFunction) {
    try {
      const { invitationId } = req.params

      await organizationService.revokeInvitation(invitationId)

      res.status(200).json({
        success: true,
        message: 'Invitation revoked',
      })
    } catch (error) {
      logger.error('[organization] Error revoking invitation', {
        error: error instanceof Error ? error.message : String(error),
        invitationId: req.params.invitationId,
      })
      next(new AppError('Failed to revoke invitation', 500))
    }
  }

  /**
   * Get invitation by token (public endpoint for accept page)
   * GET /api/invitations/:token
   */
  static async getInvitationByToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params

      const invitation = await organizationService.getInvitationByToken(token)

      // Check if expired
      if (invitation.expires_at < new Date()) {
        return next(new AppError('Invitation has expired', 410))
      }

      // Check if already accepted
      if (invitation.accepted_at) {
        return next(new AppError('Invitation has already been used', 410))
      }

      res.status(200).json({
        success: true,
        data: { invitation },
      })
    } catch (error) {
      logger.error('[organization] Error getting invitation', {
        error: error instanceof Error ? error.message : String(error),
        token: req.params.token,
      })

      if (error instanceof Error && error.message.includes('Invalid')) {
        return next(new AppError(error.message, 404))
      }

      next(new AppError('Failed to get invitation', 500))
    }
  }

  /**
   * Accept invitation
   * POST /api/invitations/:token/accept
   */
  static async acceptInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params
      const userId = req.user!.id

      const organization = await organizationService.acceptInvitation(token, userId)

      res.status(200).json({
        success: true,
        data: { organization },
        message: 'Successfully joined organization',
      })
    } catch (error) {
      logger.error('[organization] Error accepting invitation', {
        error: error instanceof Error ? error.message : String(error),
        token: req.params.token,
      })

      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('already')) {
          return next(new AppError(error.message, 400))
        }
      }

      next(new AppError('Failed to accept invitation', 500))
    }
  }
}
