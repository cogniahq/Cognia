import { prisma } from '../../lib/prisma.lib'
import { OrgRole } from '@prisma/client'

export class OrganizationAccessService {
  /**
   * Get user's membership in an organization by slug
   * Includes security settings needed for middleware enforcement
   */
  async getUserMembership(userId: string, orgSlug: string) {
    return prisma.organizationMember.findFirst({
      where: {
        user_id: userId,
        organization: {
          slug: orgSlug,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            // Security settings for middleware
            ip_allowlist: true,
            session_timeout: true,
            require_2fa: true,
          },
        },
      },
    })
  }

  /**
   * Get user's membership in an organization by ID
   */
  async getUserMembershipById(userId: string, organizationId: string) {
    return prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: userId,
        },
      },
    })
  }

  /**
   * Check if user is a member of the organization
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.getUserMembershipById(userId, organizationId)
    return !!membership
  }

  /**
   * Check if user has at least the required role
   */
  async hasRole(userId: string, organizationId: string, requiredRole: OrgRole): Promise<boolean> {
    const membership = await this.getUserMembershipById(userId, organizationId)
    if (!membership) return false

    return this.roleHasPermission(membership.role, requiredRole)
  }

  /**
   * Check if user can view documents (any role)
   */
  async canView(userId: string, organizationId: string): Promise<boolean> {
    return this.isMember(userId, organizationId)
  }

  /**
   * Check if user can upload/edit documents (Admin or Editor)
   */
  async canEdit(userId: string, organizationId: string): Promise<boolean> {
    return this.hasRole(userId, organizationId, OrgRole.EDITOR)
  }

  /**
   * Check if user can manage org (Admin only)
   */
  async canAdmin(userId: string, organizationId: string): Promise<boolean> {
    return this.hasRole(userId, organizationId, OrgRole.ADMIN)
  }

  /**
   * Check if a role has permission for the required role level
   * ADMIN > EDITOR > VIEWER
   */
  private roleHasPermission(userRole: OrgRole, requiredRole: OrgRole): boolean {
    const roleHierarchy: Record<OrgRole, number> = {
      [OrgRole.ADMIN]: 3,
      [OrgRole.EDITOR]: 2,
      [OrgRole.VIEWER]: 1,
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }
}

export const organizationAccessService = new OrganizationAccessService()
