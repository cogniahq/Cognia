import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma.lib'
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllForUser,
} from '../services/auth/refresh-token.service'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('admin revoke prevents refresh-token-based session restoration', async () => {
  const u = await prisma.user.create({ data: { email: `r-${randomUUID()}@x.io` } })
  const { token } = await issueRefreshToken(u.id, {})

  // Simulate the admin revocation path: the route calls revokeAllForUser
  // (jwt-revocation) AND revokeRefreshForUser (refresh-token). The
  // refresh-token-side revocation is what guarantees a "revoked" user
  // cannot mint a fresh JWT through /auth/refresh.
  await revokeAllForUser(u.id)

  await assert.rejects(() => rotateRefreshToken(token, {}), /revoked/i)
})
