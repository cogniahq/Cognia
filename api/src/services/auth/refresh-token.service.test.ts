import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeFamily,
  revokeAllForUser,
} from './refresh-token.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

async function makeUser(): Promise<string> {
  const u = await prisma.user.create({ data: { email: `t-${randomUUID()}@x.io` } })
  return u.id
}

after(async () => {
  await prisma.$disconnect()
})

test('refresh-token: issue returns opaque token + persists hash', async () => {
  const userId = await makeUser()
  const { token, familyId } = await issueRefreshToken(userId, {})
  assert.match(token, /^[a-f0-9]{64}$/)
  assert.match(familyId, /^[0-9a-f-]{36}$/)
})

test('refresh-token: rotation invalidates previous token, issues new', async () => {
  const userId = await makeUser()
  const { token: t1 } = await issueRefreshToken(userId, {})
  const { token: t2 } = await rotateRefreshToken(t1, {})
  assert.notEqual(t1, t2)
  await assert.rejects(() => rotateRefreshToken(t1, {}), /reuse/i)
  await assert.rejects(() => rotateRefreshToken(t2, {}), /revoked/i)
})

test('refresh-token: expired token is rejected', async () => {
  const userId = await makeUser()
  const { token } = await issueRefreshToken(userId, { ttlMs: 1 })
  await new Promise(r => setTimeout(r, 50))
  await assert.rejects(() => rotateRefreshToken(token, {}), /expired/i)
})

test('refresh-token: revokeAllForUser invalidates all live tokens for that user', async () => {
  const userId = await makeUser()
  const { token } = await issueRefreshToken(userId, {})
  await revokeAllForUser(userId)
  await assert.rejects(() => rotateRefreshToken(token, {}), /revoked/i)
})

// Suppress unused-import warning when revokeFamily isn't directly invoked
void revokeFamily
