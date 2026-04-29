import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'

const RETENTION_DAYS: Record<string, number | null> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  unlimited: null,
}

const ORG_LESS_DEFAULT_DAYS = 90

export async function runAuditRetentionPurge(): Promise<{
  deletedCount: number
  orgsScanned: number
}> {
  let totalDeleted = 0
  let orgsScanned = 0

  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true, audit_retention: true },
  })

  for (const org of orgs) {
    orgsScanned++
    const days = RETENTION_DAYS[org.audit_retention] ?? null
    if (days === null) continue
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const result = await prisma.auditLog.deleteMany({
      where: { organization_id: org.id, created_at: { lt: cutoff } },
    })
    if (result.count > 0) {
      logger.log('[audit-retention] purged org logs', {
        orgId: org.id,
        orgSlug: org.slug,
        deleted: result.count,
        retention: org.audit_retention,
      })
    }
    totalDeleted += result.count
  }

  // Org-less logs: 90-day default
  const orglessCutoff = new Date(Date.now() - ORG_LESS_DEFAULT_DAYS * 24 * 60 * 60 * 1000)
  const orglessResult = await prisma.auditLog.deleteMany({
    where: { organization_id: null, created_at: { lt: orglessCutoff } },
  })
  totalDeleted += orglessResult.count
  if (orglessResult.count > 0) {
    logger.log('[audit-retention] purged orgless logs', {
      deleted: orglessResult.count,
      cutoff: orglessCutoff.toISOString(),
    })
  }

  logger.log('[audit-retention] complete', { totalDeleted, orgsScanned })
  return { deletedCount: totalDeleted, orgsScanned }
}

const RETENTION_INTERVAL_MS = 12 * 60 * 60 * 1000 // every 12 hours

let timer: NodeJS.Timeout | null = null

export function startAuditRetentionWorker(intervalMs = RETENTION_INTERVAL_MS): void {
  if (timer) {
    logger.warn('[audit-retention] worker already running')
    return
  }
  // Run once at startup, then on interval
  void runAuditRetentionPurge().catch(err =>
    logger.error('[audit-retention] purge failed', { error: String(err) })
  )
  timer = setInterval(() => {
    void runAuditRetentionPurge().catch(err =>
      logger.error('[audit-retention] purge failed', { error: String(err) })
    )
  }, intervalMs)
  // Don't keep the process alive solely for this timer
  timer.unref?.()
}

export function stopAuditRetentionWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
