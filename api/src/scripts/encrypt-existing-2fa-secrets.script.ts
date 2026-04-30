import { prisma } from '../lib/prisma.lib'
import { encrypt2faSecret, is2faSecretLegacy } from '../services/auth/two-factor.service'
import { logger } from '../utils/core/logger.util'

async function main(): Promise<void> {
  if (!process.env.TWO_FACTOR_ENCRYPTION_KEY) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not set')
  }
  const users = await prisma.user.findMany({
    where: {
      two_factor_enabled: true,
      two_factor_secret: { not: null },
    },
    select: { id: true, two_factor_secret: true },
  })
  let migrated = 0
  for (const u of users) {
    if (!u.two_factor_secret) continue
    if (!is2faSecretLegacy(u.two_factor_secret)) continue
    await prisma.user.update({
      where: { id: u.id },
      data: { two_factor_secret: encrypt2faSecret(u.two_factor_secret) },
    })
    migrated++
  }
  logger.log('[encrypt-2fa-backfill] complete', {
    candidates: users.length,
    migrated,
  })
  await prisma.$disconnect()
}

main().catch(err => {
  logger.error('[encrypt-2fa-backfill] failed', { error: String(err) })
  process.exit(1)
})
