import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { prisma } from '../lib/prisma.lib'
import mcpRouter from './mcp.route'
import { randomBytes, createHash, randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeKey(scopes: string[]) {
  const u = await prisma.user.create({ data: { email: `mcp-${randomUUID()}@x.io` } })
  const raw = `ck_live_${randomBytes(28).toString('base64url')}`
  const hash = createHash('sha256').update(raw).digest('hex')
  await prisma.apiKey.create({
    data: {
      user_id: u.id,
      name: 'mcp',
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
  app.use('/mcp', mcpRouter)
  return app
}

test('mcp: initialize returns server info', async () => {
  const { token } = await makeKey(['*'])
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/mcp/v1/jsonrpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
  })
  const body = (await r.json()) as { result: { serverInfo: { name: string } } }
  server.close()
  assert.equal(body.result.serverInfo.name, 'cognia-mcp')
})

test('mcp: tools/list returns 3 tools', async () => {
  const { token } = await makeKey(['*'])
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/mcp/v1/jsonrpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })
  const body = (await r.json()) as { result: { tools: { name: string }[] } }
  server.close()
  assert.equal(body.result.tools.length, 3)
  const names = body.result.tools.map(t => t.name)
  assert.ok(names.includes('cognia.search'))
  assert.ok(names.includes('cognia.get_memory'))
  assert.ok(names.includes('cognia.list_memories'))
})

test('mcp: missing auth returns 401', async () => {
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/mcp/v1/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
  })
  server.close()
  assert.equal(r.status, 401)
})

test('mcp: tools/call cognia.search returns wrapped result', async () => {
  const { token, userId } = await makeKey(['*'])
  // seed a memory the search should find
  await prisma.memory.create({
    data: {
      user_id: userId,
      source: 'TEST',
      content: 'My favourite color is rosé pamplemousse',
      title: 'colour pref',
      timestamp: BigInt(Date.now()),
    },
  })

  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/mcp/v1/jsonrpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'cognia.search', arguments: { query: 'pamplemousse', limit: 5 } },
    }),
  })
  const body = (await r.json()) as {
    result: { content: { type: string; text: string }[] }
  }
  server.close()
  assert.equal(body.result.content[0].type, 'text')
  const parsed = JSON.parse(body.result.content[0].text) as { title: string }[]
  assert.ok(parsed.some(m => m.title === 'colour pref'))
})

test('mcp: unknown method returns -32601 error', async () => {
  const { token } = await makeKey(['*'])
  const app = makeApp()
  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const r = await fetch(`http://127.0.0.1:${port}/mcp/v1/jsonrpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'foo/bar' }),
  })
  const body = (await r.json()) as { error: { code: number } }
  server.close()
  assert.equal(body.error.code, -32601)
})
