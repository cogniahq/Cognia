import { randomUUID, createHash, timingSafeEqual } from 'crypto'

import { prisma } from '../../lib/prisma.lib'
import type { PlatformActorContext } from '../../types/platform.types'

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function compareSecret(secret: string, secretHash: string): boolean {
  const provided = Buffer.from(hashSecret(secret), 'hex')
  const stored = Buffer.from(secretHash, 'hex')

  if (provided.length !== stored.length) {
    return false
  }

  return timingSafeEqual(provided, stored)
}

export class PlatformAuthService {
  hashSecret(secret: string): string {
    return hashSecret(secret)
  }

  generateSecret(): string {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  }

  async authenticateApp(appId: string, secret: string) {
    const app = await prisma.trustedPlatformApp.findUnique({
      where: { app_id: appId },
    })

    if (!app || !app.active) {
      return null
    }

    if (!compareSecret(secret, app.secret_hash)) {
      return null
    }

    return app
  }

  async resolveTenant(appId: string, tenantExternalId: string) {
    return prisma.platformTenantLink.findFirst({
      where: {
        trusted_app: {
          app_id: appId,
        },
        external_id: tenantExternalId,
        active: true,
      },
      include: {
        organization: true,
      },
    })
  }

  async resolveUser(appId: string, actorExternalUserId: string) {
    return prisma.platformUserLink.findFirst({
      where: {
        trusted_app: {
          app_id: appId,
        },
        external_id: actorExternalUserId,
        active: true,
      },
      include: {
        user: true,
      },
    })
  }

  async hasOrganizationMembership(organizationId: string, userId: string): Promise<boolean> {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: userId,
        },
      },
      select: { id: true },
    })

    return Boolean(membership)
  }

  parseActorContext(headers: Record<string, string | string[] | undefined>): PlatformActorContext {
    const tenantExternalId = this.requireSingleHeader(
      headers['x-platform-tenant-external-id'],
      'x-platform-tenant-external-id'
    )
    const actorExternalUserId = this.requireSingleHeader(
      headers['x-platform-actor-external-user-id'],
      'x-platform-actor-external-user-id'
    )
    const actorEmail = this.requireSingleHeader(
      headers['x-platform-actor-email'],
      'x-platform-actor-email'
    )
    const actorRole = this.requireSingleHeader(
      headers['x-platform-actor-role'],
      'x-platform-actor-role'
    )
    const requestId =
      this.getSingleHeader(headers['x-platform-request-id']) ||
      `req_${randomUUID().replace(/-/g, '')}`

    return {
      tenantExternalId,
      actorExternalUserId,
      actorEmail,
      actorRole,
      requestId,
    }
  }

  private getSingleHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0]
    }

    return value
  }

  private requireSingleHeader(value: string | string[] | undefined, headerName: string): string {
    const header = this.getSingleHeader(value)?.trim()

    if (!header) {
      throw new Error(`${headerName} header is required`)
    }

    return header
  }
}

export const platformAuthService = new PlatformAuthService()
