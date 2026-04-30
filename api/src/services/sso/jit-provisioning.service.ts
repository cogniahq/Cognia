import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import type { OrgRole } from '@prisma/client'

export interface SsoAssertion {
  email: string
  externalId: string // unique IdP id (saml subjectNameID or oidc sub)
  groups?: string[]
  name?: string
  orgSlug: string
}

export interface ProvisionResult {
  userId: string
  organizationId: string
  isNewUser: boolean
  isNewMember: boolean
  role: OrgRole
}

/**
 * Map IdP groups to an OrgRole using an org's sso_role_mapping.
 * If multiple groups match, the highest privilege role (ADMIN > EDITOR > VIEWER) wins.
 */
function mapGroupsToRole(
  groups: string[] | undefined,
  mapping: unknown,
  defaultRole: OrgRole = 'VIEWER'
): OrgRole {
  if (!groups || !mapping || typeof mapping !== 'object') return defaultRole
  const m = mapping as Record<string, string>
  const ranking: OrgRole[] = ['ADMIN', 'EDITOR', 'VIEWER']
  let best: OrgRole | null = null
  for (const g of groups) {
    const target = m[g]
    if (!target) continue
    const upper = target.toUpperCase()
    if (upper === 'ADMIN' || upper === 'EDITOR' || upper === 'VIEWER') {
      const role = upper as OrgRole
      if (!best || ranking.indexOf(role) < ranking.indexOf(best)) {
        best = role
      }
    }
  }
  return best ?? defaultRole
}

/**
 * Provision (or sync) a user + organization member from an SSO assertion.
 * - Creates the user when missing (email is auto-verified since IdP attests it).
 * - Creates the org member when missing.
 * - Otherwise syncs the role from the assertion mapping.
 * - Enforces sso_email_domains allowlist if present on the org.
 */
export async function provisionFromAssertion(assertion: SsoAssertion): Promise<ProvisionResult> {
  const org = await prisma.organization.findUnique({ where: { slug: assertion.orgSlug } })
  if (!org) throw new Error(`Org ${assertion.orgSlug} not found`)
  if (!org.sso_enabled || !org.sso_provider) {
    throw new Error(`SSO not enabled for ${assertion.orgSlug}`)
  }

  // Domain enforcement
  const emailDomain = assertion.email.split('@')[1]?.toLowerCase()
  if (
    org.sso_email_domains.length > 0 &&
    (!emailDomain || !org.sso_email_domains.includes(emailDomain))
  ) {
    throw new Error(`Email domain ${emailDomain} is not in this org's SSO allowlist`)
  }

  let user = await prisma.user.findUnique({ where: { email: assertion.email } })
  let isNewUser = false
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: assertion.email,
        email_verified_at: new Date(), // SSO IdP attests email
      },
    })
    isNewUser = true
  } else if (!user.email_verified_at) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verified_at: new Date() },
    })
  }

  const role = mapGroupsToRole(assertion.groups, org.sso_role_mapping)
  const existingMember = await prisma.organizationMember.findFirst({
    where: { organization_id: org.id, user_id: user.id },
  })
  let isNewMember = false
  if (!existingMember) {
    await prisma.organizationMember.create({
      data: { organization_id: org.id, user_id: user.id, role },
    })
    isNewMember = true
  } else if (existingMember.role !== role) {
    // Sync role from IdP
    await prisma.organizationMember.update({
      where: { id: existingMember.id },
      data: { role },
    })
  }

  logger.log('[sso-jit] provisioned', {
    userId: user.id,
    orgId: org.id,
    isNewUser,
    isNewMember,
    role,
  })
  return {
    userId: user.id,
    organizationId: org.id,
    isNewUser,
    isNewMember,
    role,
  }
}
