import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { seedSampleWorkspace, purgeDemoData } from './sample-workspace-seeder.service'
import { prisma } from '../../lib/prisma.lib'

after(async () => {
  await prisma.$disconnect()
})

test('seeder: creates demo memories with DEMO source_type', async () => {
  const u = await prisma.user.create({ data: { email: `seed-${randomUUID()}@x.io` } })
  try {
    const { created } = await seedSampleWorkspace(u.id)
    assert.ok(created > 0, 'expected at least one demo memory to be created')
    const count = await prisma.memory.count({
      where: { user_id: u.id, source_type: 'DEMO' },
    })
    assert.equal(count, created)
  } finally {
    await prisma.memory.deleteMany({ where: { user_id: u.id } })
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
  }
})

test('purge: removes only DEMO memories for the user and stamps demo_dismissed_at', async () => {
  const u = await prisma.user.create({ data: { email: `p-${randomUUID()}@x.io` } })
  try {
    await seedSampleWorkspace(u.id)
    // Add a non-demo memory to verify purge is scoped
    await prisma.memory.create({
      data: {
        user_id: u.id,
        source: 'extension',
        source_type: 'EXTENSION',
        title: 'real',
        content: 'real',
        memory_type: 'LOG_EVENT',
        confidence_score: 0.5,
        timestamp: BigInt(Date.now()),
      },
    })
    const { deleted } = await purgeDemoData(u.id)
    assert.ok(deleted > 0, 'expected purge to delete demo memories')
    const remaining = await prisma.memory.count({ where: { user_id: u.id } })
    assert.equal(remaining, 1, 'only the EXTENSION memory should remain')
    const afterUser = await prisma.user.findUnique({ where: { id: u.id } })
    assert.notEqual(afterUser?.demo_dismissed_at, null)
  } finally {
    await prisma.memory.deleteMany({ where: { user_id: u.id } })
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
  }
})
