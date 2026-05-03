import { prisma } from '../../lib/prisma.lib'
import type {
  PlatformMembershipRef,
  PlatformTenantRef,
  PlatformUserRef,
} from '../../types/platform.types'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export class PlatformSyncService {
  private async buildUniqueOrganizationSlug(
    baseInput: string,
    organizationId?: string
  ): Promise<string> {
    const base = slugify(baseInput) || 'platform-tenant'
    let candidate = base
    let suffix = 2
    let existing = await prisma.organization.findFirst({
      where: {
        slug: candidate,
        ...(organizationId ? { NOT: { id: organizationId } } : {}),
      },
      select: { id: true },
    })

    while (existing) {
      candidate = `${base}-${suffix}`
      suffix += 1

      existing = await prisma.organization.findFirst({
        where: {
          slug: candidate,
          ...(organizationId ? { NOT: { id: organizationId } } : {}),
        },
        select: { id: true },
      })
    }

    return candidate
  }

  async upsertTenant(appId: string, tenant: PlatformTenantRef) {
    const trustedApp = await prisma.trustedPlatformApp.findUniqueOrThrow({
      where: { app_id: appId },
      select: { id: true },
    })

    const existingLink = await prisma.platformTenantLink.findUnique({
      where: {
        trusted_app_id_external_id: {
          trusted_app_id: trustedApp.id,
          external_id: tenant.externalId,
        },
      },
      include: {
        organization: true,
      },
    })

    const slug = await this.buildUniqueOrganizationSlug(
      tenant.slug || tenant.name || tenant.externalId,
      existingLink?.organization_id
    )

    if (existingLink) {
      const organization = await prisma.organization.update({
        where: { id: existingLink.organization_id },
        data: {
          name: tenant.name,
          slug,
          description: tenant.description || undefined,
        },
      })

      const link = await prisma.platformTenantLink.update({
        where: { id: existingLink.id },
        data: { active: tenant.active !== false },
        include: {
          organization: true,
        },
      })

      return { organization, tenantLink: link }
    }

    return prisma.$transaction(async tx => {
      const organization = await tx.organization.create({
        data: {
          name: tenant.name,
          slug,
          description: tenant.description || undefined,
        },
      })

      const tenantLink = await tx.platformTenantLink.create({
        data: {
          trusted_app_id: trustedApp.id,
          external_id: tenant.externalId,
          organization_id: organization.id,
          active: tenant.active !== false,
        },
        include: {
          organization: true,
        },
      })

      return { organization, tenantLink }
    })
  }

  async deactivateTenant(appId: string, externalId: string) {
    const trustedApp = await prisma.trustedPlatformApp.findUniqueOrThrow({
      where: { app_id: appId },
      select: { id: true },
    })

    return prisma.platformTenantLink.update({
      where: {
        trusted_app_id_external_id: {
          trusted_app_id: trustedApp.id,
          external_id: externalId,
        },
      },
      data: {
        active: false,
      },
      include: {
        organization: true,
      },
    })
  }

  async upsertUser(appId: string, user: PlatformUserRef) {
    const trustedApp = await prisma.trustedPlatformApp.findUniqueOrThrow({
      where: { app_id: appId },
      select: { id: true },
    })

    const existingLink = await prisma.platformUserLink.findUnique({
      where: {
        trusted_app_id_external_id: {
          trusted_app_id: trustedApp.id,
          external_id: user.externalId,
        },
      },
      include: {
        user: true,
      },
    })

    const active = user.active !== false

    if (existingLink) {
      const updatedUser = await prisma.user.update({
        where: { id: existingLink.user_id },
        data: {
          email: user.email,
        },
      })

      const userLink = await prisma.platformUserLink.update({
        where: { id: existingLink.id },
        data: { active },
        include: {
          user: true,
        },
      })

      return { user: updatedUser, userLink }
    }

    return prisma.$transaction(async tx => {
      const existingUserByEmail = await tx.user.findFirst({
        where: { email: user.email },
      })

      const cogniaUser =
        existingUserByEmail ||
        (await tx.user.create({
          data: {
            email: user.email,
          },
        }))

      const userLink = await tx.platformUserLink.create({
        data: {
          trusted_app_id: trustedApp.id,
          external_id: user.externalId,
          user_id: cogniaUser.id,
          active,
        },
        include: {
          user: true,
        },
      })

      return { user: cogniaUser, userLink }
    })
  }

  async deactivateUser(appId: string, externalId: string) {
    const trustedApp = await prisma.trustedPlatformApp.findUniqueOrThrow({
      where: { app_id: appId },
      select: { id: true },
    })

    const link = await prisma.platformUserLink.update({
      where: {
        trusted_app_id_external_id: {
          trusted_app_id: trustedApp.id,
          external_id: externalId,
        },
      },
      data: {
        active: false,
      },
      include: {
        user: true,
      },
    })

    const memberships = await prisma.platformTenantLink.findMany({
      where: {
        trusted_app_id: trustedApp.id,
      },
      select: {
        organization_id: true,
      },
    })

    if (memberships.length > 0) {
      await prisma.organizationMember.deleteMany({
        where: {
          user_id: link.user_id,
          organization_id: {
            in: memberships.map(membership => membership.organization_id),
          },
        },
      })
    }

    return link
  }

  async syncMemberships(
    appId: string,
    tenantExternalId: string,
    members: PlatformMembershipRef[],
    removeMissing: boolean = true
  ) {
    const trustedApp = await prisma.trustedPlatformApp.findUniqueOrThrow({
      where: { app_id: appId },
      select: { id: true },
    })

    const tenantLink = await prisma.platformTenantLink.findUniqueOrThrow({
      where: {
        trusted_app_id_external_id: {
          trusted_app_id: trustedApp.id,
          external_id: tenantExternalId,
        },
      },
    })

    const externalUserIds = members.map(member => member.userExternalId)
    const linkedUsers = await prisma.platformUserLink.findMany({
      where: {
        trusted_app_id: trustedApp.id,
        external_id: { in: externalUserIds },
        active: true,
      },
    })

    const linkedUserMap = new Map(linkedUsers.map(link => [link.external_id, link]))
    const missing = externalUserIds.filter(externalId => !linkedUserMap.has(externalId))

    if (missing.length > 0) {
      throw new Error(`Missing platform users for memberships: ${missing.join(', ')}`)
    }

    await prisma.$transaction(async tx => {
      for (const member of members) {
        const linkedUser = linkedUserMap.get(member.userExternalId)

        if (!linkedUser) {
          continue
        }

        await tx.organizationMember.upsert({
          where: {
            organization_id_user_id: {
              organization_id: tenantLink.organization_id,
              user_id: linkedUser.user_id,
            },
          },
          update: {
            role: member.role,
          },
          create: {
            organization_id: tenantLink.organization_id,
            user_id: linkedUser.user_id,
            role: member.role,
          },
        })
      }

      if (removeMissing) {
        const retainedUserIds = linkedUsers.map(link => link.user_id)
        const linkedPlatformUsers = await tx.platformUserLink.findMany({
          where: {
            trusted_app_id: trustedApp.id,
            active: true,
          },
          select: {
            user_id: true,
          },
        })

        await tx.organizationMember.deleteMany({
          where: {
            organization_id: tenantLink.organization_id,
            user_id: {
              in: linkedPlatformUsers
                .map(link => link.user_id)
                .filter(userId => !retainedUserIds.includes(userId)),
            },
          },
        })
      }
    })

    return prisma.organizationMember.findMany({
      where: {
        organization_id: tenantLink.organization_id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    })
  }
}

export const platformSyncService = new PlatformSyncService()
