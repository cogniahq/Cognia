import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { OrgRole } from '@prisma/client'
import { randomBytes } from 'crypto'
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  UpdateOrganizationProfileInput,
  UpdateOrganizationBillingInput,
  UpdateOrganizationSecurityInput,
  AddMemberInput,
  UpdateMemberInput,
  OrganizationWithMembers,
  SetupProgress,
  CreateInvitationInput,
} from '../../types/organization.types'

const SETUP_STEPS = ['create', 'profile', 'billing', 'security', 'team', 'integrations']

export class OrganizationService {
  /**
   * Create a new organization with the creator as admin
   */
  async createOrganization(
    creatorId: string,
    input: CreateOrganizationInput
  ): Promise<OrganizationWithMembers> {
    const existing = await prisma.organization.findUnique({
      where: { slug: input.slug },
    })

    if (existing) {
      throw new Error('Organization with this slug already exists')
    }

    const organization = await prisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        industry: input.industry,
        team_size: input.teamSize,
        setup_completed_steps: ['create'],
        setup_started_at: new Date(),
        members: {
          create: {
            user_id: creatorId,
            role: OrgRole.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })

    logger.log('[organization] created', {
      organizationId: organization.id,
      slug: organization.slug,
      industry: input.industry,
      teamSize: input.teamSize,
      creatorId,
    })

    return organization
  }

  /**
   * Get all organizations a user belongs to
   */
  async getUserOrganizations(userId: string): Promise<OrganizationWithMembers[]> {
    const memberships = await prisma.organizationMember.findMany({
      where: { user_id: userId },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true },
                },
              },
            },
          },
        },
      },
    })

    return memberships.map(m => m.organization)
  }

  /**
   * Get organization by slug with members
   */
  async getOrganizationBySlug(slug: string): Promise<OrganizationWithMembers | null> {
    return prisma.organization.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<OrganizationWithMembers | null> {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })
  }

  /**
   * Update organization (admin only)
   */
  async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationWithMembers> {
    if (input.slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug: input.slug,
          NOT: { id: organizationId },
        },
      })

      if (existing) {
        throw new Error('Organization with this slug already exists')
      }
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.slug && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })

    logger.log('[organization] updated', {
      organizationId: organization.id,
      updates: input,
    })

    return organization
  }

  /**
   * Delete organization (admin only)
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    await prisma.organization.delete({
      where: { id: organizationId },
    })

    logger.log('[organization] deleted', { organizationId })
  }

  /**
   * Add member to organization by userId
   */
  async addMember(organizationId: string, input: AddMemberInput) {
    const existing = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: input.userId,
        },
      },
    })

    if (existing) {
      throw new Error('User is already a member of this organization')
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const member = await prisma.organizationMember.create({
      data: {
        organization_id: organizationId,
        user_id: input.userId,
        role: input.role || OrgRole.VIEWER,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    logger.log('[organization] member_added', {
      organizationId,
      userId: input.userId,
      role: member.role,
    })

    return member
  }

  /**
   * Add member to organization by email
   */
  async addMemberByEmail(organizationId: string, email: string, role: OrgRole = OrgRole.VIEWER) {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new Error('User not found. They need to create an account first.')
    }

    const existing = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: user.id,
        },
      },
    })

    if (existing) {
      throw new Error('User is already a member of this organization')
    }

    const member = await prisma.organizationMember.create({
      data: {
        organization_id: organizationId,
        user_id: user.id,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    logger.log('[organization] member_added_by_email', {
      organizationId,
      email,
      role: member.role,
    })

    return member
  }

  /**
   * Get all members of an organization
   */
  async getMembers(organizationId: string) {
    return prisma.organizationMember.findMany({
      where: { organization_id: organizationId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: { created_at: 'asc' },
    })
  }

  /**
   * Update member role
   */
  async updateMemberRole(memberId: string, input: UpdateMemberInput) {
    const member = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: input.role },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    logger.log('[organization] member_role_updated', {
      memberId,
      newRole: input.role,
    })

    return member
  }

  /**
   * Remove member from organization
   */
  async removeMember(memberId: string): Promise<void> {
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    })

    if (!member) {
      throw new Error('Member not found')
    }

    // Check if this is the last admin
    const adminCount = await prisma.organizationMember.count({
      where: {
        organization_id: member.organization_id,
        role: OrgRole.ADMIN,
      },
    })

    if (member.role === OrgRole.ADMIN && adminCount <= 1) {
      throw new Error('Cannot remove the last admin from organization')
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    })

    logger.log('[organization] member_removed', { memberId })
  }

  /**
   * Get all memories for an organization (from document chunks)
   */
  async getOrganizationMemories(organizationId: string, limit: number = 10000) {
    // Get all document chunks with memory_ids for this organization
    const chunks = await prisma.documentChunk.findMany({
      where: {
        document: {
          organization_id: organizationId,
        },
        memory_id: {
          not: null,
        },
      },
      select: {
        memory_id: true,
      },
      distinct: ['memory_id'],
    })

    const memoryIds = chunks
      .map(c => c.memory_id)
      .filter((id): id is string => id !== null)

    if (memoryIds.length === 0) {
      return []
    }

    // Fetch the actual memories
    const memories = await prisma.memory.findMany({
      where: {
        id: {
          in: memoryIds,
        },
      },
      include: {
        related_memories: {
          select: {
            related_memory_id: true,
            similarity_score: true,
          },
        },
        related_to_memories: {
          select: {
            memory_id: true,
            similarity_score: true,
          },
        },
      },
      take: limit,
      orderBy: { created_at: 'desc' },
    })

    logger.log('[organization] memories_fetched', {
      organizationId,
      count: memories.length,
    })

    return memories
  }

  /**
   * Get organization memory count
   */
  async getOrganizationMemoryCount(organizationId: string): Promise<number> {
    const result = await prisma.documentChunk.findMany({
      where: {
        document: {
          organization_id: organizationId,
        },
        memory_id: {
          not: null,
        },
      },
      select: {
        memory_id: true,
      },
      distinct: ['memory_id'],
    })

    return result.length
  }

  /**
   * Get memory IDs for an organization (for mesh visualization)
   */
  async getOrganizationMemoryIds(organizationId: string, limit: number = 10000): Promise<string[]> {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        document: {
          organization_id: organizationId,
        },
        memory_id: {
          not: null,
        },
      },
      select: {
        memory_id: true,
      },
      distinct: ['memory_id'],
      take: limit,
    })

    return chunks
      .map(c => c.memory_id)
      .filter((id): id is string => id !== null)
  }

  // ==========================================
  // Enterprise Setup Methods
  // ==========================================

  /**
   * Update organization profile
   */
  async updateProfile(
    organizationId: string,
    input: UpdateOrganizationProfileInput
  ): Promise<OrganizationWithMembers> {
    if (input.slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug: input.slug,
          NOT: { id: organizationId },
        },
      })

      if (existing) {
        throw new Error('Organization with this slug already exists')
      }
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.slug && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.logo !== undefined && { logo: input.logo }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.streetAddress !== undefined && { street_address: input.streetAddress }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.stateRegion !== undefined && { state_region: input.stateRegion }),
        ...(input.postalCode !== undefined && { postal_code: input.postalCode }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })

    // Mark profile step as complete if logo or description is set
    if (organization.logo || organization.description) {
      await this.markSetupStepComplete(organizationId, 'profile')
    }

    logger.log('[organization] profile_updated', {
      organizationId,
      updates: Object.keys(input),
    })

    return organization
  }

  /**
   * Update organization billing settings
   */
  async updateBilling(
    organizationId: string,
    input: UpdateOrganizationBillingInput
  ): Promise<OrganizationWithMembers> {
    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.legalName !== undefined && { legal_name: input.legalName }),
        ...(input.billingEmail !== undefined && { billing_email: input.billingEmail }),
        ...(input.billingAddress !== undefined && { billing_address: input.billingAddress }),
        ...(input.vatTaxId !== undefined && { vat_tax_id: input.vatTaxId }),
        ...(input.plan !== undefined && { plan: input.plan }),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })

    // Mark billing step as complete if required fields are set
    if (organization.legal_name && organization.billing_email && organization.plan) {
      await this.markSetupStepComplete(organizationId, 'billing')
    }

    logger.log('[organization] billing_updated', {
      organizationId,
      plan: input.plan,
    })

    return organization
  }

  /**
   * Update organization security settings
   */
  async updateSecurity(
    organizationId: string,
    input: UpdateOrganizationSecurityInput
  ): Promise<OrganizationWithMembers> {
    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.dataResidency !== undefined && { data_residency: input.dataResidency }),
        ...(input.require2FA !== undefined && { require_2fa: input.require2FA }),
        ...(input.sessionTimeout !== undefined && { session_timeout: input.sessionTimeout }),
        ...(input.passwordPolicy !== undefined && { password_policy: input.passwordPolicy }),
        ...(input.auditRetention !== undefined && { audit_retention: input.auditRetention }),
        ...(input.ipAllowlist !== undefined && { ip_allowlist: input.ipAllowlist }),
        ...(input.ssoEnabled !== undefined && { sso_enabled: input.ssoEnabled }),
        ...(input.ssoConfig !== undefined && { sso_config: input.ssoConfig }),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    })

    // Mark security step as complete
    await this.markSetupStepComplete(organizationId, 'security')

    logger.log('[organization] security_updated', {
      organizationId,
      updates: Object.keys(input),
    })

    return organization
  }

  /**
   * Get setup progress for an organization
   */
  async getSetupProgress(organizationId: string): Promise<SetupProgress> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        setup_completed_steps: true,
        setup_started_at: true,
        setup_completed_at: true,
      },
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    const completedSteps = org.setup_completed_steps || []
    const percentComplete = Math.round((completedSteps.length / SETUP_STEPS.length) * 100)

    return {
      completedSteps,
      totalSteps: SETUP_STEPS.length,
      percentComplete,
      startedAt: org.setup_started_at,
      completedAt: org.setup_completed_at,
    }
  }

  /**
   * Mark a setup step as complete
   */
  async markSetupStepComplete(organizationId: string, step: string): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { setup_completed_steps: true },
    })

    if (!org) return

    const completedSteps = org.setup_completed_steps || []
    if (completedSteps.includes(step)) return

    const newCompletedSteps = [...completedSteps, step]
    const isComplete = SETUP_STEPS.every(s => newCompletedSteps.includes(s))

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        setup_completed_steps: newCompletedSteps,
        ...(isComplete && { setup_completed_at: new Date() }),
      },
    })

    logger.log('[organization] setup_step_completed', {
      organizationId,
      step,
      isComplete,
    })
  }

  /**
   * Skip a setup step
   */
  async skipSetupStep(organizationId: string, step: string): Promise<void> {
    await this.markSetupStepComplete(organizationId, step)
  }

  /**
   * Mark security prompt as shown
   */
  async markSecurityPromptShown(organizationId: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { security_prompt_shown: true },
    })
  }

  // ==========================================
  // Invitation Methods
  // ==========================================

  /**
   * Create an invitation to join the organization
   */
  async createInvitation(
    organizationId: string,
    invitedBy: string,
    input: CreateInvitationInput
  ) {
    // Check if user already exists and is a member
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    })

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: organizationId,
            user_id: existingUser.id,
          },
        },
      })

      if (existingMember) {
        throw new Error('User is already a member of this organization')
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.organizationInvitation.findUnique({
      where: {
        organization_id_email: {
          organization_id: organizationId,
          email: input.email,
        },
      },
    })

    if (existingInvitation && existingInvitation.expires_at > new Date()) {
      throw new Error('An invitation has already been sent to this email')
    }

    // Delete expired invitation if exists
    if (existingInvitation) {
      await prisma.organizationInvitation.delete({
        where: { id: existingInvitation.id },
      })
    }

    // Create new invitation
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organization_id: organizationId,
        email: input.email,
        role: input.role || OrgRole.VIEWER,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt,
      },
    })

    // Mark team step as complete
    await this.markSetupStepComplete(organizationId, 'team')

    logger.log('[organization] invitation_created', {
      organizationId,
      email: input.email,
      role: invitation.role,
    })

    return invitation
  }

  /**
   * Get all pending invitations for an organization
   */
  async getInvitations(organizationId: string) {
    return prisma.organizationInvitation.findMany({
      where: {
        organization_id: organizationId,
        accepted_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    })
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: true },
    })

    if (!invitation) {
      throw new Error('Invalid invitation token')
    }

    if (invitation.expires_at < new Date()) {
      throw new Error('Invitation has expired')
    }

    if (invitation.accepted_at) {
      throw new Error('Invitation has already been used')
    }

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: invitation.organization_id,
          user_id: userId,
        },
      },
    })

    if (existingMember) {
      throw new Error('You are already a member of this organization')
    }

    // Add user as member and mark invitation as accepted
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
        },
      }),
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { accepted_at: new Date() },
      }),
    ])

    logger.log('[organization] invitation_accepted', {
      organizationId: invitation.organization_id,
      userId,
      role: invitation.role,
    })

    return invitation.organization
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    await prisma.organizationInvitation.delete({
      where: { id: invitationId },
    })

    logger.log('[organization] invitation_revoked', { invitationId })
  }

  /**
   * Get invitation by token (for accept page)
   */
  async getInvitationByToken(token: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    })

    if (!invitation) {
      throw new Error('Invalid invitation token')
    }

    return invitation
  }
}

export const organizationService = new OrganizationService()
