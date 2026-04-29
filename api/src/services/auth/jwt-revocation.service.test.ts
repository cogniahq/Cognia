import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  revokeJti,
  isJtiRevoked,
  revokeAllForUser,
  isUserRevokedSince,
} from './jwt-revocation.service'
import { getRedisClient } from '../../lib/redis.lib'

const TEST_JTI = 'test-jti-' + Date.now()
const TEST_USER = 'user-' + Date.now()

after(async () => {
  await getRedisClient().quit()
})

test('jwt-revocation: a fresh jti is not revoked', async () => {
  assert.equal(await isJtiRevoked(TEST_JTI), false)
})

test('jwt-revocation: revokeJti marks it revoked', async () => {
  await revokeJti(TEST_JTI, 60_000)
  assert.equal(await isJtiRevoked(TEST_JTI), true)
})

test('jwt-revocation: revokeAllForUser invalidates tokens issued before now', async () => {
  const beforeIat = Math.floor(Date.now() / 1000) - 10
  await revokeAllForUser(TEST_USER)
  assert.equal(await isUserRevokedSince(TEST_USER, beforeIat), true)
})

test('jwt-revocation: revokeAllForUser does not invalidate tokens issued after the revoke timestamp', async () => {
  const userId = TEST_USER + '-2'
  await revokeAllForUser(userId)
  await new Promise(r => setTimeout(r, 1100))
  const afterIat = Math.floor(Date.now() / 1000)
  assert.equal(await isUserRevokedSince(userId, afterIat), false)
})
