import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'

export async function applyOrgHold(
  orgId: string,
  until: Date,
  actorUserId: string,
  actorEmail: string | null,
  reason?: string
): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { legal_hold_until: until },
  })
  await auditLogService
    .logOrgEvent({
      orgId,
      actorUserId,
      actorEmail,
      eventType: 'legal_hold_applied',
      eventCategory: 'compliance',
      action: 'apply-hold',
      metadata: { until: until.toISOString(), reason },
    })
    .catch(() => {})
}

export async function releaseOrgHold(
  orgId: string,
  actorUserId: string,
  actorEmail: string | null
): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { legal_hold_until: null },
  })
  await auditLogService
    .logOrgEvent({
      orgId,
      actorUserId,
      actorEmail,
      eventType: 'legal_hold_released',
      eventCategory: 'compliance',
      action: 'release-hold',
    })
    .catch(() => {})
}

export async function applyUserHold(userId: string, until: Date): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { legal_hold_until: until } })
}

export async function releaseUserHold(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { legal_hold_until: null } })
}

export async function isOrgUnderHold(orgId: string): Promise<boolean> {
  const o = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { legal_hold_until: true },
  })
  return !!(o?.legal_hold_until && o.legal_hold_until > new Date())
}
