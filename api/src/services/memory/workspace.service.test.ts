import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createWorkspace, listWorkspaces, moveMemoryToWorkspace } from './workspace.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('workspace: create + list + slug uniqueness', async () => {
  const u = await prisma.user.create({ data: { email: `w-${randomUUID()}@x.io` } })
  const o = await prisma.organization.create({
    data: { name: `t-${randomUUID()}`, slug: `t-${randomUUID()}` },
  })
  const a = await createWorkspace(o.id, 'Engineering', u.id)
  const b = await createWorkspace(o.id, 'Engineering', u.id)
  assert.notEqual(a.slug, b.slug)
  const list = await listWorkspaces(o.id)
  assert.equal(list.length, 2)
})

test('workspace: moveMemory assigns workspace_id', async () => {
  const u = await prisma.user.create({ data: { email: `mv-${randomUUID()}@x.io` } })
  const o = await prisma.organization.create({
    data: { name: `m-${randomUUID()}`, slug: `m-${randomUUID()}` },
  })
  const w = await createWorkspace(o.id, 'A', u.id)
  const m = await prisma.memory.create({
    data: {
      user_id: u.id,
      organization_id: o.id,
      source: 't',
      content: 'x',
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
  const moved = await moveMemoryToWorkspace(m.id, u.id, w.id)
  assert.equal(moved.workspace_id, w.id)
})
