import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createShare, getMemoryByShareLink, canRead, revokeShare } from './share.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeMemory() {
  const u = await prisma.user.create({ data: { email: `s-${randomUUID()}@x.io` } })
  const m = await prisma.memory.create({
    data: {
      user_id: u.id,
      source: 'test',
      title: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  return { u, m }
}

test('share: link share grants read via getMemoryByShareLink', async () => {
  const { u, m } = await makeMemory()
  const s = await createShare({ memoryId: m.id, sharerUserId: u.id, recipientType: 'LINK' })
  assert.ok(s.link_token)
  const out = await getMemoryByShareLink(s.link_token!)
  assert.equal(out?.memory.id, m.id)
})

test('share: revoked link returns null', async () => {
  const { u, m } = await makeMemory()
  const s = await createShare({ memoryId: m.id, sharerUserId: u.id, recipientType: 'LINK' })
  await revokeShare(s.id, u.id)
  const out = await getMemoryByShareLink(s.link_token!)
  assert.equal(out, null)
})

test('share: user share grants canRead to recipient only', async () => {
  const { u: owner, m } = await makeMemory()
  const recipient = await prisma.user.create({ data: { email: `r-${randomUUID()}@x.io` } })
  const stranger = await prisma.user.create({ data: { email: `s-${randomUUID()}@x.io` } })
  await createShare({
    memoryId: m.id,
    sharerUserId: owner.id,
    recipientType: 'USER',
    recipientUserId: recipient.id,
  })
  assert.equal(await canRead(m.id, recipient.id), true)
  assert.equal(await canRead(m.id, stranger.id), false)
})

test('share: expired share denies access', async () => {
  const { u: owner, m } = await makeMemory()
  const recipient = await prisma.user.create({ data: { email: `e-${randomUUID()}@x.io` } })
  await createShare({
    memoryId: m.id,
    sharerUserId: owner.id,
    recipientType: 'USER',
    recipientUserId: recipient.id,
    expiresAt: new Date(Date.now() - 1000),
  })
  assert.equal(await canRead(m.id, recipient.id), false)
})
