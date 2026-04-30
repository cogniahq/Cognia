import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 min for magic links + verify
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000

export type TokenPurpose = 'verify_email' | 'magic_link' | 'password_reset'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

interface IssueOptions {
  ttlMs?: number
}

export async function issueEmailVerificationToken(
  userId: string,
  purpose: TokenPurpose,
  opts: IssueOptions = {}
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const ttl = opts.ttlMs ?? (purpose === 'password_reset' ? PASSWORD_RESET_TTL_MS : DEFAULT_TTL_MS)
  const expiresAt = new Date(Date.now() + ttl)
  await prisma.emailVerificationToken.create({
    data: {
      user_id: userId,
      purpose,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    },
  })
  return { token, expiresAt }
}

export async function consumeEmailVerificationToken(
  token: string,
  expectedPurpose: TokenPurpose
): Promise<{ userId: string }> {
  const hash = hashToken(token)
  const row = await prisma.emailVerificationToken.findUnique({ where: { token_hash: hash } })
  if (!row) throw new Error('Token not found')
  if (row.purpose !== expectedPurpose) throw new Error('Token purpose mismatch')
  if (row.used_at) throw new Error('Token already used')
  if (row.expires_at < new Date()) throw new Error('Token expired')
  await prisma.emailVerificationToken.update({
    where: { id: row.id },
    data: { used_at: new Date() },
  })
  if (expectedPurpose === 'verify_email') {
    await prisma.user.update({
      where: { id: row.user_id },
      data: { email_verified_at: new Date() },
    })
  }
  return { userId: row.user_id }
}

/**
 * Stub email-sender. In Phase 7 this is wired to Resend / Postmark / SES.
 * For now it just logs the would-be-sent message so dev flows can copy
 * the URL out of logs.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  purpose: TokenPurpose
): Promise<void> {
  const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
  const path =
    purpose === 'magic_link'
      ? '/auth/magic'
      : purpose === 'password_reset'
        ? '/auth/reset'
        : '/auth/verify'
  const url = `${baseUrl}${path}?token=${token}`
  logger.log('[email][stub] would send', { to: email, purpose, url })
}
