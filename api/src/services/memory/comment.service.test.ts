import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { postComment, listComments, editComment, deleteComment } from './comment.service'
import { createShare } from './share.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('comments: owner can post and list; stranger cannot list', async () => {
  const owner = await prisma.user.create({ data: { email: `co-${randomUUID()}@x.io` } })
  const stranger = await prisma.user.create({ data: { email: `cs-${randomUUID()}@x.io` } })
  const m = await prisma.memory.create({
    data: {
      user_id: owner.id,
      source: 't',
      title: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  await postComment({ memoryId: m.id, authorUserId: owner.id, bodyMd: 'first' })
  const out = await listComments(m.id, owner.id)
  assert.equal(out.length, 1)
  await assert.rejects(() => listComments(m.id, stranger.id), /Not allowed/)
})

test('comments: shared user can comment with COMMENT permission', async () => {
  const owner = await prisma.user.create({ data: { email: `co-${randomUUID()}@x.io` } })
  const shared = await prisma.user.create({ data: { email: `cc-${randomUUID()}@x.io` } })
  const m = await prisma.memory.create({
    data: {
      user_id: owner.id,
      source: 't',
      title: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  await createShare({
    memoryId: m.id,
    sharerUserId: owner.id,
    recipientType: 'USER',
    recipientUserId: shared.id,
    permission: 'COMMENT',
  })
  const c = await postComment({ memoryId: m.id, authorUserId: shared.id, bodyMd: 'hi' })
  assert.ok(c.id)
})

test('comments: edit own works, delete own marks deleted_at', async () => {
  const u = await prisma.user.create({ data: { email: `ed-${randomUUID()}@x.io` } })
  const m = await prisma.memory.create({
    data: {
      user_id: u.id,
      source: 't',
      title: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  const c = await postComment({ memoryId: m.id, authorUserId: u.id, bodyMd: 'a' })
  const e = await editComment(c.id, u.id, 'b')
  assert.equal(e.body_md, 'b')
  await deleteComment(c.id, u.id)
  const list = await listComments(m.id, u.id)
  assert.equal(list.length, 0)
})
