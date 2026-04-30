import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { searchOrg } from './ediscovery.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('ediscovery: finds matching memories across users in org', async () => {
  const org = await prisma.organization.create({
    data: { name: `e-${randomUUID()}`, slug: `e-${randomUUID()}` },
  })
  const u = await prisma.user.create({ data: { email: `e-${randomUUID()}@x.io` } })
  await prisma.memory.create({
    data: {
      user_id: u.id,
      organization_id: org.id,
      source: 't',
      title: 'Project Phoenix Q1 plan',
      content: 'launch by march',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  const result = await searchOrg({
    orgId: org.id,
    query: 'Phoenix',
    actorUserId: u.id,
    actorEmail: u.email,
  })
  assert.equal(result.memories.length, 1)
})
