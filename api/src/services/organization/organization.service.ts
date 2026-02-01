import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { OrgRole } from '@prisma/client'
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddMemberInput,
  UpdateMemberInput,
  OrganizationWithMembers,
} from '../../types/organization.types'

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
}

export const organizationService = new OrganizationService()
