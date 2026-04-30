import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createTag, listTags, attachTag, detachTag } from './tag.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('tag: per-user create + attach + detach', async () => {
  const u = await prisma.user.create({ data: { email: `t-${randomUUID()}@x.io` } })
  const m = await prisma.memory.create({
    data: {
      user_id: u.id,
      source: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  const tag = await createTag({ userId: u.id }, 'important', '#ff0000')
  await attachTag(m.id, u.id, tag.id)
  const list = await listTags({ userId: u.id })
  assert.equal(list.length, 1)
  await detachTag(m.id, u.id, tag.id)
  const fresh = await prisma.memoryTagOnMemory.findFirst({ where: { tag_id: tag.id } })
  assert.equal(fresh, null)
})
