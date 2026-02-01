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
      const { name, description } = req.body
      let { slug } = req.body

      if (!name) {
        return next(new AppError('Name is required', 400))
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

      const organization = await organizationService.createOrganization(userId, { name, slug, description })

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

      // Build mesh from those memory IDs, filtering to only DOCUMENT source type
      const mesh = await memoryMeshService.getMemoryMeshForMemoryIds(
        memoryIds,
        limit,
        threshold,
        {
          sourceType: 'DOCUMENT',
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
}
