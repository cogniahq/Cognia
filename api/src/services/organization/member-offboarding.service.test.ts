import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { offboardMember } from './member-offboarding.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrgWithMembers() {
  const admin = await prisma.user.create({ data: { email: `a-${randomUUID()}@x.io` } })
  const leaver = await prisma.user.create({ data: { email: `l-${randomUUID()}@x.io` } })
  const successor = await prisma.user.create({ data: { email: `s-${randomUUID()}@x.io` } })
  const org = await prisma.organization.create({
    data: { name: `o-${randomUUID()}`, slug: `o-${randomUUID()}` },
  })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: admin.id, role: 'ADMIN' },
  })
  const leaverMembership = await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: leaver.id, role: 'EDITOR' },
  })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: successor.id, role: 'EDITOR' },
  })
  return { admin, leaver, successor, org, leaverMembership }
}

test('offboard: soft-delete sets deactivated_at and audit-logs', async () => {
  const { admin, leaver, org, leaverMembership } = await makeOrgWithMembers()
  await offboardMember({
    organizationId: org.id,
    memberId: leaverMembership.id,
    actorUserId: admin.id,
    actorEmail: admin.email,
    reason: 'left company',
  })
  const m = await prisma.organizationMember.findUnique({ where: { id: leaverMembership.id } })
  assert.notEqual(m?.deactivated_at, null)
  const logs = await prisma.auditLog.findMany({
    where: { organization_id: org.id, event_type: 'member_deactivated' },
  })
  assert.equal(logs.length, 1)
  assert.equal(logs[0].target_user_id, leaver.id)
})

test('offboard: hard delete removes the row and logs member_removed', async () => {
  const { admin, org, leaverMembership } = await makeOrgWithMembers()
  await offboardMember({
    organizationId: org.id,
    memberId: leaverMembership.id,
    actorUserId: admin.id,
    actorEmail: admin.email,
    hardDelete: true,
  })
  const m = await prisma.organizationMember.findUnique({ where: { id: leaverMembership.id } })
  assert.equal(m, null)
  const logs = await prisma.auditLog.findMany({
    where: { organization_id: org.id, event_type: 'member_removed' },
  })
  assert.equal(logs.length, 1)
})
