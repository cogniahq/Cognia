import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  scheduleAccountDeletion,
  cancelAccountDeletion,
  runScheduledDeletions,
} from './account-deletion.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('account-deletion: schedule sets timestamp', async () => {
  const u = await prisma.user.create({ data: { email: `d-${randomUUID()}@x.io` } })
  const out = await scheduleAccountDeletion(u.id)
  assert.ok(out.scheduledFor instanceof Date)
  const fresh = await prisma.user.findUnique({ where: { id: u.id } })
  assert.notEqual(fresh?.deletion_scheduled_at, null)
})

test('account-deletion: cancel clears timestamp', async () => {
  const u = await prisma.user.create({ data: { email: `c-${randomUUID()}@x.io` } })
  await scheduleAccountDeletion(u.id)
  await cancelAccountDeletion(u.id)
  const fresh = await prisma.user.findUnique({ where: { id: u.id } })
  assert.equal(fresh?.deletion_scheduled_at, null)
})

test('account-deletion: legal hold blocks scheduling', async () => {
  const u = await prisma.user.create({
    data: {
      email: `h-${randomUUID()}@x.io`,
      legal_hold_until: new Date(Date.now() + 86400000),
    },
  })
  await assert.rejects(() => scheduleAccountDeletion(u.id), /legal hold/i)
})

test('account-deletion: worker purges expired but skips legal-hold', async () => {
  const past = new Date(Date.now() - 86400000)
  const expiredUser = await prisma.user.create({
    data: { email: `e-${randomUUID()}@x.io`, deletion_scheduled_at: past },
  })
  const heldUser = await prisma.user.create({
    data: {
      email: `e-${randomUUID()}@x.io`,
      deletion_scheduled_at: past,
      legal_hold_until: new Date(Date.now() + 86400000),
    },
  })
  await runScheduledDeletions()
  const expired = await prisma.user.findUnique({ where: { id: expiredUser.id } })
  const held = await prisma.user.findUnique({ where: { id: heldUser.id } })
  assert.equal(expired, null)
  assert.notEqual(held, null)
})
