import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'
import { revokeAllForUser as revokeJwts } from '../auth/jwt-revocation.service'
import { revokeAllForUser as revokeRefresh } from '../auth/refresh-token.service'

interface OffboardOptions {
  organizationId: string
  memberId: string
  actorUserId: string
  actorEmail: string | null
  reassignDocsToUserId?: string
  hardDelete?: boolean
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export async function offboardMember(opts: OffboardOptions): Promise<void> {
  const member = await prisma.organizationMember.findUnique({
    where: { id: opts.memberId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!member) throw new Error('Member not found')
  if (member.organization_id !== opts.organizationId) throw new Error('Member not in this org')

  if (opts.reassignDocsToUserId) {
    const target = await prisma.organizationMember.findFirst({
      where: {
        organization_id: opts.organizationId,
        user_id: opts.reassignDocsToUserId,
        deactivated_at: null,
      },
    })
    if (!target) throw new Error('Reassignment target is not an active member of this org')
    await prisma.document.updateMany({
      where: { organization_id: opts.organizationId, uploader_id: member.user_id },
      data: { uploader_id: opts.reassignDocsToUserId },
    })
  }

  await Promise.all([revokeJwts(member.user_id), revokeRefresh(member.user_id)])

  if (opts.hardDelete) {
    await prisma.organizationMember.delete({ where: { id: member.id } })
  } else {
    await prisma.organizationMember.update({
      where: { id: member.id },
      data: { deactivated_at: new Date(), deactivation_reason: opts.reason },
    })
  }

  await auditLogService.logOrgEvent({
    orgId: opts.organizationId,
    actorUserId: opts.actorUserId,
    actorEmail: opts.actorEmail,
    eventType: opts.hardDelete ? 'member_removed' : 'member_deactivated',
    eventCategory: 'organization',
    action: opts.hardDelete ? 'remove-member' : 'deactivate-member',
    targetUserId: member.user_id,
    targetResourceType: 'organization_member',
    targetResourceId: member.id,
    metadata: {
      reason: opts.reason,
      reassignedDocsTo: opts.reassignDocsToUserId,
      memberEmail: member.user.email,
    },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  })
}
