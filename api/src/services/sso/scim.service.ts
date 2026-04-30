import { prisma } from '../../lib/prisma.lib'
import { revokeAllForUser as revokeJwts } from '../auth/jwt-revocation.service'
import { revokeAllForUser as revokeRefresh } from '../auth/refresh-token.service'
import type { OrgRole, Prisma } from '@prisma/client'
import { auditLogService } from '../core/audit-log.service'

type MemberWithUser = Prisma.OrganizationMemberGetPayload<{ include: { user: true } }>

interface ScimPatchOp {
  op: string
  path?: string
  value?: unknown
}

interface ScimUserPayload {
  userName?: string
  emails?: { value?: string; primary?: boolean; type?: string }[]
  groups?: { value?: string; display?: string }[]
  [key: string]: unknown
}

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group'

export interface ScimUser {
  schemas: string[]
  id: string
  externalId?: string
  userName: string
  active: boolean
  emails: { value: string; primary: boolean }[]
  name?: { givenName?: string; familyName?: string }
  meta: { resourceType: 'User'; created?: string; lastModified?: string }
  groups?: { value: string; display: string }[]
}

export function memberToScim(member: MemberWithUser, _baseUrl: string): ScimUser {
  return {
    schemas: [USER_SCHEMA],
    id: member.id,
    externalId: member.user.email ?? undefined,
    userName: member.user.email ?? member.user.id,
    active: !member.deactivated_at,
    emails: member.user.email ? [{ value: member.user.email, primary: true }] : [],
    meta: {
      resourceType: 'User',
      created: member.created_at?.toISOString?.() ?? undefined,
      lastModified: member.user.updated_at?.toISOString?.() ?? undefined,
    },
    groups: [{ value: member.role, display: member.role }],
  }
}

export async function listUsers(
  orgId: string,
  opts: { filter?: string; startIndex?: number; count?: number },
  baseUrl: string
) {
  const startIndex = Math.max(opts.startIndex ?? 1, 1)
  const count = Math.min(opts.count ?? 100, 200)
  const skip = startIndex - 1

  const where: Prisma.OrganizationMemberWhereInput = { organization_id: orgId }
  if (opts.filter) {
    // Support a couple of common filters: userName eq "x", emails.value eq "y", externalId eq "z"
    const m = opts.filter.match(/(userName|externalId|emails\.value)\s+eq\s+"([^"]+)"/i)
    if (m) {
      const email = m[2]
      where.user = { email }
    }
  }

  const [members, total] = await Promise.all([
    prisma.organizationMember.findMany({
      where,
      include: { user: true },
      orderBy: { created_at: 'asc' },
      skip,
      take: count,
    }),
    prisma.organizationMember.count({ where }),
  ])

  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: total,
    startIndex,
    itemsPerPage: members.length,
    Resources: members.map(m => memberToScim(m, baseUrl)),
  }
}

export async function getUser(
  orgId: string,
  memberId: string,
  baseUrl: string
): Promise<ScimUser | null> {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organization_id: orgId },
    include: { user: true },
  })
  return member ? memberToScim(member, baseUrl) : null
}

export async function createUser(
  orgId: string,
  body: ScimUserPayload,
  baseUrl: string,
  actor: { actorUserId: string | null; actorEmail: string | null }
) {
  const email = body?.emails?.[0]?.value ?? body?.userName
  if (!email) throw new Error('userName/email required')
  const role: OrgRole = (body?.groups?.[0]?.value as OrgRole) ?? 'VIEWER'

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, email_verified_at: new Date() },
  })
  let member = await prisma.organizationMember.findFirst({
    where: { organization_id: orgId, user_id: user.id },
    include: { user: true },
  })
  if (!member) {
    member = await prisma.organizationMember.create({
      data: { organization_id: orgId, user_id: user.id, role },
      include: { user: true },
    })
    await auditLogService
      .logOrgEvent({
        orgId,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        eventType: 'scim_user_provisioned',
        eventCategory: 'organization',
        action: 'scim-create',
        targetUserId: user.id,
        targetResourceType: 'organization_member',
        targetResourceId: member.id,
        metadata: { email, role },
      })
      .catch(() => {})
  } else if (member.deactivated_at) {
    member = await prisma.organizationMember.update({
      where: { id: member.id },
      data: { deactivated_at: null, deactivation_reason: null, role },
      include: { user: true },
    })
  }
  return memberToScim(member, baseUrl)
}

export async function patchUser(
  orgId: string,
  memberId: string,
  ops: ScimPatchOp[],
  baseUrl: string,
  actor: { actorUserId: string | null; actorEmail: string | null }
): Promise<ScimUser | null> {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organization_id: orgId },
    include: { user: true },
  })
  if (!member) return null

  for (const op of ops ?? []) {
    const opName = String(op.op).toLowerCase()
    const path = (op.path as string | undefined)?.toLowerCase()
    if (
      (opName === 'replace' || opName === 'add') &&
      (path === 'active' || (op.value && typeof op.value === 'object' && 'active' in op.value))
    ) {
      const active =
        path === 'active' ? Boolean(op.value) : Boolean((op.value as { active?: unknown }).active)
      if (!active && !member.deactivated_at) {
        await prisma.organizationMember.update({
          where: { id: member.id },
          data: { deactivated_at: new Date(), deactivation_reason: 'scim deprovision' },
        })
        await Promise.all([revokeJwts(member.user_id), revokeRefresh(member.user_id)])
        await auditLogService
          .logOrgEvent({
            orgId,
            actorUserId: actor.actorUserId,
            actorEmail: actor.actorEmail,
            eventType: 'scim_user_deprovisioned',
            eventCategory: 'organization',
            action: 'scim-deactivate',
            targetUserId: member.user_id,
            targetResourceType: 'organization_member',
            targetResourceId: member.id,
          })
          .catch(() => {})
      } else if (active && member.deactivated_at) {
        await prisma.organizationMember.update({
          where: { id: member.id },
          data: { deactivated_at: null, deactivation_reason: null },
        })
      }
    }
  }
  const fresh = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    include: { user: true },
  })
  return fresh ? memberToScim(fresh, baseUrl) : null
}

export async function deleteUser(
  orgId: string,
  memberId: string,
  actor: { actorUserId: string | null; actorEmail: string | null }
): Promise<boolean> {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organization_id: orgId },
    include: { user: true },
  })
  if (!member) return false
  await Promise.all([revokeJwts(member.user_id), revokeRefresh(member.user_id)])
  await prisma.organizationMember.delete({ where: { id: member.id } })
  await auditLogService
    .logOrgEvent({
      orgId,
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      eventType: 'scim_user_deprovisioned',
      eventCategory: 'organization',
      action: 'scim-delete',
      targetUserId: member.user_id,
      targetResourceType: 'organization_member',
      targetResourceId: member.id,
    })
    .catch(() => {})
  return true
}

// Groups: 3 fixed groups corresponding to OrgRole
export function listGroups(_orgId: string) {
  const groups = ['ADMIN', 'EDITOR', 'VIEWER'].map(r => ({
    schemas: [GROUP_SCHEMA],
    id: r,
    displayName: r,
    meta: { resourceType: 'Group' },
  }))
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 3,
    startIndex: 1,
    itemsPerPage: 3,
    Resources: groups,
  }
}
