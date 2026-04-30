import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { authenticateApiKey, requireScope } from './api-key.middleware'
import { prisma } from '../lib/prisma.lib'
import { randomBytes, createHash, randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeKey(scopes: string[]) {
  const u = await prisma.user.create({ data: { email: `k-${randomUUID()}@x.io` } })
  const raw = `ck_live_${randomBytes(28).toString('base64url')}`
  const hash = createHash('sha256').update(raw).digest('hex')
  await prisma.apiKey.create({
    data: { user_id: u.id, name: 't', prefix: raw.slice(0, 16), key_hash: hash, scopes },
  })
  return raw
}

async function tryRoute(token: string, scope?: string) {
  const app = express()
  app.use(express.json())
  const middlewares: any[] = [authenticateApiKey]
  if (scope) middlewares.push(requireScope(scope))
  app.get('/', ...middlewares, (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  const port = (server.address() as any).port
  const r = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  server.close()
  return r.status
}

test('api-key: valid key + matching scope -> 200', async () => {
  const token = await makeKey(['memories.read'])
  assert.equal(await tryRoute(token, 'memories.read'), 200)
})

test('api-key: missing scope -> 403', async () => {
  const token = await makeKey(['memories.read'])
  assert.equal(await tryRoute(token, 'memories.write'), 403)
})

test('api-key: bad token -> 401', async () => {
  assert.equal(await tryRoute('ck_live_invalid'), 401)
})

test('api-key: no Authorization header -> 401', async () => {
  const app = express()
  app.use(authenticateApiKey)
  app.get('/', (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  const port = (server.address() as any).port
  const r = await fetch(`http://127.0.0.1:${port}/`)
  server.close()
  assert.equal(r.status, 401)
})
