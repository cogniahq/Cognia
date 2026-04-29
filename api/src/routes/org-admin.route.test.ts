import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import { prisma } from '../lib/prisma.lib'
import { getRedisClient } from '../lib/redis.lib'
import orgAdminRouter from './org-admin.route'
import { generateToken } from '../utils/auth/jwt.util'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
  try {
    await getRedisClient().quit()
  } catch {
    // ignore
  }
})

async function setup(role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
  const user = await prisma.user.create({ data: { email: `${role}-${randomUUID()}@x.io` } })
  const org = await prisma.organization.create({
    data: { name: `t-${randomUUID()}`, slug: `s-${randomUUID()}` },
  })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: user.id, role },
  })
  const token = generateToken({ userId: user.id, email: user.email ?? undefined })
  return { user, org, token }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/org-admin', orgAdminRouter)
  return app
}

test('org-admin: ADMIN can list members', async () => {
  const { org, token } = await setup('ADMIN')
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/api/org-admin/${org.slug}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await r.json()
  server.close()
  assert.equal(r.status, 200)
  assert.equal(body.success, true)
  assert.ok(Array.isArray(body.data))
})

test('org-admin: VIEWER is rejected (403)', async () => {
  const { org, token } = await setup('VIEWER')
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/api/org-admin/${org.slug}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  server.close()
  assert.equal(r.status, 403)
})

test('org-admin: security-status returns 2FA enrollment %', async () => {
  const { org, token } = await setup('ADMIN')
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/api/org-admin/${org.slug}/security-status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await r.json()
  server.close()
  assert.equal(r.status, 200)
  assert.ok(body.data.twoFaEnrollment)
  assert.equal(typeof body.data.twoFaEnrollment.percentage, 'number')
})
