import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { prisma } from '../lib/prisma.lib'
import { getRedisClient } from '../lib/redis.lib'
import v1Router from './v1.route'
import { randomBytes, createHash, randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
  // Rate limiter inside v1.route opens a redis connection; close it so
  // node:test exits instead of waiting on the open socket.
  try {
    await getRedisClient().quit()
  } catch {
    /* swallow — best effort */
  }
})

async function makeKey(scopes: string[]) {
  const u = await prisma.user.create({ data: { email: `v1-${randomUUID()}@x.io` } })
  const raw = `ck_live_${randomBytes(28).toString('base64url')}`
  const hash = createHash('sha256').update(raw).digest('hex')
  await prisma.apiKey.create({
    data: {
      user_id: u.id,
      name: 'v1-test',
      prefix: raw.slice(0, 16),
      key_hash: hash,
      scopes,
    },
  })
  return { token: raw, userId: u.id }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/v1', v1Router)
  return app
}

test('GET /v1/memories clamps ?limit=10000 to <= 100', async () => {
  const { token, userId } = await makeKey(['*'])
  // Seed 105 memories so an unclamped limit would happily return >100.
  const seedRows = Array.from({ length: 105 }, (_, i) => ({
    user_id: userId,
    source: 'TEST',
    content: `seed memory ${i}`,
    title: `seed-${i}`,
    timestamp: BigInt(Date.now() + i),
  }))
  await prisma.memory.createMany({ data: seedRows })

  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  try {
    const r = await fetch(`http://127.0.0.1:${port}/v1/memories?limit=10000`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(r.status, 200)
    const body = (await r.json()) as { data: unknown[] }
    assert.ok(Array.isArray(body.data))
    assert.ok(
      body.data.length <= 100,
      `expected <= 100 items after clamp, got ${body.data.length}`
    )
  } finally {
    server.close()
  }
})
