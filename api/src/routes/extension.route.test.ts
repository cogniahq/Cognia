import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import { prisma } from '../lib/prisma.lib'
import { getRedisClient } from '../lib/redis.lib'
import extensionRouter from './extension.route'
import profileRouter from './profile.route'
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

async function makeUser() {
  const user = await prisma.user.create({ data: { email: `u-${randomUUID()}@x.io` } })
  const token = generateToken({ userId: user.id, email: user.email ?? undefined })
  return { user, token }
}

async function makeOrgWithWorkspace(role: 'ADMIN' | 'EDITOR' | 'VIEWER', userId: string) {
  const org = await prisma.organization.create({
    data: { name: `o-${randomUUID()}`, slug: `s-${randomUUID()}` },
  })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: userId, role },
  })
  const workspace = await prisma.workspace.create({
    data: {
      organization_id: org.id,
      name: 'WS',
      slug: `ws-${randomUUID()}`,
      created_by_user_id: userId,
    },
  })
  return { org, workspace }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/extension', extensionRouter)
  app.use('/api/profile', profileRouter)
  return app
}

async function withServer<T>(app: express.Express, fn: (port: number) => Promise<T>): Promise<T> {
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  try {
    return await fn(port)
  } finally {
    server.close()
  }
}

test('extension destinations: personal-only user', async () => {
  const { token } = await makeUser()
  const app = makeApp()
  await withServer(app, async port => {
    const r = await fetch(`http://127.0.0.1:${port}/api/extension/destinations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    assert.equal(r.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.personal, true)
    assert.deepEqual(body.data.organizations, [])
    assert.deepEqual(body.data.default, { organizationId: null, workspaceId: null })
  })
})

test('extension destinations: multi-org user with workspaces', async () => {
  const { user, token } = await makeUser()
  const { org: org1, workspace: ws1 } = await makeOrgWithWorkspace('ADMIN', user.id)
  const { org: org2 } = await makeOrgWithWorkspace('EDITOR', user.id)
  const app = makeApp()
  await withServer(app, async port => {
    const r = await fetch(`http://127.0.0.1:${port}/api/extension/destinations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    assert.equal(r.status, 200)
    assert.equal(body.data.personal, true)
    const ids = body.data.organizations.map((o: { id: string }) => o.id).sort()
    assert.deepEqual(ids, [org1.id, org2.id].sort())
    const found1 = body.data.organizations.find((o: { id: string }) => o.id === org1.id)
    assert.ok(found1)
    assert.equal(found1.role, 'ADMIN')
    assert.ok(found1.workspaces.find((w: { id: string }) => w.id === ws1.id))
  })
})

test('PUT capture-destination: rejects org user is not a member of', async () => {
  const { token } = await makeUser()
  const { user: otherUser } = await makeUser()
  const { org } = await makeOrgWithWorkspace('ADMIN', otherUser.id)
  const app = makeApp()
  await withServer(app, async port => {
    const r = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: org.id, workspaceId: null }),
    })
    assert.ok(r.status === 403 || r.status === 400)
  })
})

test('PUT capture-destination: rejects workspace not in given org', async () => {
  const { user, token } = await makeUser()
  const { org: org1 } = await makeOrgWithWorkspace('ADMIN', user.id)
  const { workspace: ws2 } = await makeOrgWithWorkspace('ADMIN', user.id)
  const app = makeApp()
  await withServer(app, async port => {
    const r = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: org1.id, workspaceId: ws2.id }),
    })
    assert.equal(r.status, 400)
  })
})

test('PUT then GET capture-destination: persists valid pair', async () => {
  const { user, token } = await makeUser()
  const { org, workspace } = await makeOrgWithWorkspace('ADMIN', user.id)
  const app = makeApp()
  await withServer(app, async port => {
    const r1 = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: org.id, workspaceId: workspace.id }),
    })
    assert.equal(r1.status, 200)
    const r2 = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r2.json()
    assert.equal(r2.status, 200)
    assert.equal(body.data.organizationId, org.id)
    assert.equal(body.data.workspaceId, workspace.id)
  })
})

test('PUT capture-destination: workspaceId without organizationId is rejected', async () => {
  const { user, token } = await makeUser()
  const { workspace } = await makeOrgWithWorkspace('ADMIN', user.id)
  const app = makeApp()
  await withServer(app, async port => {
    const r = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: null, workspaceId: workspace.id }),
    })
    assert.equal(r.status, 400)
  })
})

test('PUT capture-destination: null/null clears to personal vault', async () => {
  const { user, token } = await makeUser()
  const { org, workspace } = await makeOrgWithWorkspace('ADMIN', user.id)
  const app = makeApp()
  await withServer(app, async port => {
    // set to org/workspace
    await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: org.id, workspaceId: workspace.id }),
    })
    // clear back to personal
    const r = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: null, workspaceId: null }),
    })
    assert.equal(r.status, 200)
    const r2 = await fetch(`http://127.0.0.1:${port}/api/profile/capture-destination`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r2.json()
    assert.equal(body.data.organizationId, null)
    assert.equal(body.data.workspaceId, null)
  })
})
