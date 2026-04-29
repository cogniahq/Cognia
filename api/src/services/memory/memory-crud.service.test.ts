import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  listMemories,
  updateMemory,
  softDeleteMemory,
  bulkSoftDelete,
  restoreMemory,
} from './memory-crud.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeMemory(userId: string, title: string, when?: Date) {
  return prisma.memory.create({
    data: {
      user_id: userId,
      source: 'test',
      title,
      content: title,
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
      ...(when ? { created_at: when } : {}),
    },
  })
}

test('crud: cursor pagination orders by created_at desc and traverses', async () => {
  const u = await prisma.user.create({ data: { email: `cur-${randomUUID()}@x.io` } })
  const now = Date.now()
  for (let i = 0; i < 25; i++) {
    await makeMemory(u.id, `m${i}`, new Date(now - i * 1000))
  }
  const page1 = await listMemories({ userId: u.id, limit: 10 })
  assert.equal(page1.items.length, 10)
  assert.ok(page1.nextCursor)
  const page2 = await listMemories({ userId: u.id, limit: 10, cursor: page1.nextCursor! })
  assert.equal(page2.items.length, 10)
  assert.notEqual(page2.items[0].id, page1.items[0].id)
})

test('crud: update writes new title', async () => {
  const u = await prisma.user.create({ data: { email: `up-${randomUUID()}@x.io` } })
  const m = await makeMemory(u.id, 'old')
  const updated = await updateMemory(u.id, m.id, { title: 'new' })
  assert.equal(updated.title, 'new')
})

test('crud: soft-delete hides from default list, restore brings back', async () => {
  const u = await prisma.user.create({ data: { email: `sd-${randomUUID()}@x.io` } })
  const m = await makeMemory(u.id, 'gone')
  await softDeleteMemory(u.id, m.id)
  const list = await listMemories({ userId: u.id })
  assert.equal(list.items.length, 0)
  const trash = await listMemories({ userId: u.id, onlyDeleted: true })
  assert.equal(trash.items.length, 1)
  await restoreMemory(u.id, m.id)
  const list2 = await listMemories({ userId: u.id })
  assert.equal(list2.items.length, 1)
})

test('crud: bulk delete soft-deletes only owner', async () => {
  const a = await prisma.user.create({ data: { email: `a-${randomUUID()}@x.io` } })
  const b = await prisma.user.create({ data: { email: `b-${randomUUID()}@x.io` } })
  const ma = await makeMemory(a.id, 'a1')
  const mb = await makeMemory(b.id, 'b1')
  const out = await bulkSoftDelete(a.id, [ma.id, mb.id])
  assert.equal(out.deleted, 1) // only A's was deleted
  assert.equal((await listMemories({ userId: a.id })).items.length, 0)
  assert.equal((await listMemories({ userId: b.id })).items.length, 1)
})
