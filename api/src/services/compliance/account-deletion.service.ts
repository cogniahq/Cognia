import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { auditLogService } from '../core/audit-log.service'
import { revokeAllForUser as revokeJwts } from '../auth/jwt-revocation.service'
import { revokeAllForUser as revokeRefresh } from '../auth/refresh-token.service'

const GRACE_PERIOD_DAYS = 30

export async function scheduleAccountDeletion(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ scheduledFor: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.legal_hold_until && user.legal_hold_until > new Date()) {
    throw new Error('Account is under legal hold and cannot be deleted')
  }
  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  await prisma.user.update({
    where: { id: userId },
    data: { deletion_scheduled_at: scheduledFor },
  })
  await Promise.all([revokeJwts(userId), revokeRefresh(userId)])
  await auditLogService
    .logEvent({
      userId,
      eventType: 'account_deleted',
      eventCategory: 'compliance',
      action: 'schedule-deletion',
      metadata: { scheduledFor: scheduledFor.toISOString() },
      ipAddress,
      userAgent,
    })
    .catch(() => {})
  return { scheduledFor }
}

export async function cancelAccountDeletion(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!user.deletion_scheduled_at) throw new Error('No deletion scheduled')
  if (user.deletion_scheduled_at < new Date()) throw new Error('Deletion already executed')
  await prisma.user.update({
    where: { id: userId },
    data: { deletion_scheduled_at: null },
  })
}

/**
 * Daily worker: actually delete users whose deletion_scheduled_at has passed.
 * Cascading FKs handle the relational cleanup.
 */
export async function runScheduledDeletions(): Promise<{ deleted: number; held: number }> {
  const now = new Date()
  const eligible = await prisma.user.findMany({
    where: {
      deletion_scheduled_at: { lt: now },
      OR: [{ legal_hold_until: null }, { legal_hold_until: { lt: now } }],
    },
    select: { id: true, email: true },
  })
  let deleted = 0
  for (const u of eligible) {
    try {
      await prisma.user.delete({ where: { id: u.id } })
      deleted++
      logger.log('[account-deletion] purged user', { userId: u.id, email: u.email })
    } catch (err) {
      logger.warn('[account-deletion] failed', { userId: u.id, error: String(err) })
    }
  }
  // Count held users (deletion_scheduled past, but legal_hold_until in future)
  const held = await prisma.user.count({
    where: { deletion_scheduled_at: { lt: now }, legal_hold_until: { gte: now } },
  })
  return { deleted, held }
}

let timer: NodeJS.Timeout | null = null
export function startAccountDeletionWorker(intervalMs = 12 * 60 * 60 * 1000): void {
  if (timer) return
  void runScheduledDeletions().catch(err =>
    logger.error('[account-deletion] failed', { error: String(err) })
  )
  timer = setInterval(() => {
    void runScheduledDeletions().catch(err =>
      logger.error('[account-deletion] failed', { error: String(err) })
    )
  }, intervalMs)
  timer.unref?.()
}
