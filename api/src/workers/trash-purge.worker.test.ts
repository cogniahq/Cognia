import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { runTrashPurge } from './trash-purge.worker'
import { prisma } from '../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('trash-purge: removes memories deleted >30 days ago, keeps recent', async () => {
  const u = await prisma.user.create({ data: { email: `tp-${randomUUID()}@x.io` } })
  const oldDeleted = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
  const recentDeleted = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  const oldM = await prisma.memory.create({
    data: {
      user_id: u.id,
      source: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
      deleted_at: oldDeleted,
    },
  })
  const recentM = await prisma.memory.create({
    data: {
      user_id: u.id,
      source: 't',
      content: 'y',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
      deleted_at: recentDeleted,
    },
  })
  await runTrashPurge()
  const oldStill = await prisma.memory.findUnique({ where: { id: oldM.id } })
  const recentStill = await prisma.memory.findUnique({ where: { id: recentM.id } })
  assert.equal(oldStill, null)
  assert.notEqual(recentStill, null)
})
