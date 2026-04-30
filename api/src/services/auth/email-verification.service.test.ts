import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  issueEmailVerificationToken,
  consumeEmailVerificationToken,
} from './email-verification.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeUser(): Promise<string> {
  const u = await prisma.user.create({ data: { email: `e-${randomUUID()}@x.io` } })
  return u.id
}

test('verify_email: round-trips and stamps email_verified_at', async () => {
  const userId = await makeUser()
  const { token } = await issueEmailVerificationToken(userId, 'verify_email')
  const { userId: out } = await consumeEmailVerificationToken(token, 'verify_email')
  assert.equal(out, userId)
  const u = await prisma.user.findUnique({ where: { id: userId } })
  assert.notEqual(u?.email_verified_at, null)
})

test('reuse rejected', async () => {
  const userId = await makeUser()
  const { token } = await issueEmailVerificationToken(userId, 'verify_email')
  await consumeEmailVerificationToken(token, 'verify_email')
  await assert.rejects(() => consumeEmailVerificationToken(token, 'verify_email'), /already used/i)
})

test('purpose mismatch rejected', async () => {
  const userId = await makeUser()
  const { token } = await issueEmailVerificationToken(userId, 'magic_link')
  await assert.rejects(() => consumeEmailVerificationToken(token, 'verify_email'), /purpose/i)
})

test('expired rejected', async () => {
  const userId = await makeUser()
  const { token } = await issueEmailVerificationToken(userId, 'verify_email', { ttlMs: 1 })
  await new Promise(r => setTimeout(r, 50))
  await assert.rejects(() => consumeEmailVerificationToken(token, 'verify_email'), /expired/i)
})
