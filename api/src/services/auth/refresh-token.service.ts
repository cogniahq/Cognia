import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

const DEFAULT_TTL_MS =
  Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '14') * 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex')
}

interface IssueOptions {
  ttlMs?: number
  ipAddress?: string
  userAgent?: string
}

export async function issueRefreshToken(
  userId: string,
  opts: IssueOptions
): Promise<{ token: string; familyId: string; expiresAt: Date }> {
  const token = generateOpaqueToken()
  const familyId = randomUUID()
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS))
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      family_id: familyId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      ip_address: opts.ipAddress,
      user_agent: opts.userAgent,
    },
  })
  return { token, familyId, expiresAt }
}

export async function rotateRefreshToken(
  presentedToken: string,
  opts: IssueOptions
): Promise<{ token: string; familyId: string; userId: string; expiresAt: Date }> {
  const hash = hashToken(presentedToken)
  const row = await prisma.refreshToken.findUnique({ where: { token_hash: hash } })

  if (!row) {
    throw new Error('Refresh token not found')
  }
  if (row.revoked_at) {
    throw new Error('Refresh token revoked')
  }
  if (row.expires_at < new Date()) {
    throw new Error('Refresh token expired')
  }
  if (row.used_at) {
    logger.warn('[refresh-token] reuse detected; revoking family', {
      userId: row.user_id,
      familyId: row.family_id,
    })
    await revokeFamily(row.family_id)
    throw new Error('Refresh token reuse detected')
  }

  const newToken = generateOpaqueToken()
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS))
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: row.id },
      data: { used_at: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        user_id: row.user_id,
        family_id: row.family_id,
        token_hash: hashToken(newToken),
        parent_id: row.id,
        expires_at: expiresAt,
        ip_address: opts.ipAddress,
        user_agent: opts.userAgent,
      },
    }),
  ])
  return { token: newToken, familyId: row.family_id, userId: row.user_id, expiresAt }
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}
