import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'

const TRASH_RETENTION_DAYS = 30

export async function runTrashPurge(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()
  const result = await prisma.memory.deleteMany({
    where: {
      deleted_at: { lt: cutoff },
      user: {
        OR: [{ legal_hold_until: null }, { legal_hold_until: { lt: now } }],
      },
      OR: [
        { organization_id: null },
        {
          organization: {
            OR: [{ legal_hold_until: null }, { legal_hold_until: { lt: now } }],
          },
        },
      ],
    },
  })
  logger.log('[trash-purge] complete', {
    deleted: result.count,
    cutoff: cutoff.toISOString(),
  })
  return { deleted: result.count }
}

let timer: NodeJS.Timeout | null = null

export function startTrashPurgeWorker(intervalMs = 12 * 60 * 60 * 1000): void {
  if (timer) return
  void runTrashPurge().catch(err => logger.error('[trash-purge] failed', { error: String(err) }))
  timer = setInterval(() => {
    void runTrashPurge().catch(err => logger.error('[trash-purge] failed', { error: String(err) }))
  }, intervalMs)
  timer.unref?.()
}
