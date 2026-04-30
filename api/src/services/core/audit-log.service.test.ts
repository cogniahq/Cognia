import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { auditLogService } from './audit-log.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrg(): Promise<string> {
  const o = await prisma.organization.create({
    data: { name: `t-${randomUUID()}`, slug: `t-${randomUUID()}` },
  })
  return o.id
}

async function makeUser(): Promise<{ id: string; email: string }> {
  const email = `u-${randomUUID()}@x.io`
  const u = await prisma.user.create({ data: { email } })
  return { id: u.id, email }
}

test('audit: logOrgEvent persists with org_id and actor_email', async () => {
  const orgId = await makeOrg()
  const actor = await makeUser()
  await auditLogService.logOrgEvent({
    orgId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    eventType: 'member_added',
    eventCategory: 'organization',
    action: 'add-member',
    targetUserId: actor.id,
    targetResourceType: 'organization_member',
  })
  const { logs, total } = await auditLogService.getOrgAuditLogs(orgId)
  assert.equal(total, 1)
  assert.equal(logs[0].event_type, 'member_added')
  assert.equal(logs[0].actor_email, actor.email)
  assert.equal(logs[0].organization_id, orgId)
})

test('audit: log survives actor deletion (user_id becomes null, actor_email persists)', async () => {
  const orgId = await makeOrg()
  const actor = await makeUser()
  await auditLogService.logOrgEvent({
    orgId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    eventType: 'role_changed',
    eventCategory: 'organization',
    action: 'change-role',
  })
  await prisma.user.delete({ where: { id: actor.id } })
  const { logs } = await auditLogService.getOrgAuditLogs(orgId)
  assert.equal(logs[0].user_id, null)
  assert.equal(logs[0].actor_email, actor.email)
})

test('audit: filters by eventType + actorUserId', async () => {
  const orgId = await makeOrg()
  const a = await makeUser()
  const b = await makeUser()
  await auditLogService.logOrgEvent({
    orgId,
    actorUserId: a.id,
    actorEmail: a.email,
    eventType: 'login_success',
    eventCategory: 'authentication',
    action: 'login',
  })
  await auditLogService.logOrgEvent({
    orgId,
    actorUserId: b.id,
    actorEmail: b.email,
    eventType: 'member_added',
    eventCategory: 'organization',
    action: 'add',
  })
  const { logs: aLogs } = await auditLogService.getOrgAuditLogs(orgId, { actorUserId: a.id })
  const { logs: memberLogs } = await auditLogService.getOrgAuditLogs(orgId, {
    eventType: 'member_added',
  })
  assert.equal(aLogs.length, 1)
  assert.equal(aLogs[0].event_type, 'login_success')
  assert.equal(memberLogs.length, 1)
  assert.equal(memberLogs[0].event_type, 'member_added')
})

test('audit: login_failed for unknown user is loggable (user_id null)', async () => {
  await auditLogService.logEvent({
    userId: null,
    eventType: 'login_failed',
    eventCategory: 'authentication',
    action: 'login',
    actorEmail: 'unknown@example.com',
    metadata: { reason: 'unknown_user' },
  })
  // Verify it landed
  const log = await prisma.auditLog.findFirst({
    where: { event_type: 'login_failed', actor_email: 'unknown@example.com' },
    orderBy: { created_at: 'desc' },
  })
  assert.ok(log, 'login_failed for unknown user should be logged')
  assert.equal(log!.user_id, null)
})
