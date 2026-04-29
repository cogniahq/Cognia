import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { runAuditRetentionPurge } from './audit-retention.worker'
import { prisma } from '../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrg(retention: string): Promise<string> {
  const o = await prisma.organization.create({
    data: { name: `r-${randomUUID()}`, slug: `r-${randomUUID()}`, audit_retention: retention },
  })
  return o.id
}

async function seedLog(orgId: string | null, ageDays: number): Promise<string> {
  const created = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)
  const l = await prisma.auditLog.create({
    data: {
      organization_id: orgId,
      event_type: 'login_success',
      event_category: 'authentication',
      action: 'login',
      created_at: created,
    },
  })
  return l.id
}

test('retention: 30d org purges logs older than 30 days, keeps newer', async () => {
  const orgId = await makeOrg('30d')
  const old = await seedLog(orgId, 35)
  const fresh = await seedLog(orgId, 5)
  await runAuditRetentionPurge()
  assert.equal(await prisma.auditLog.findUnique({ where: { id: old } }), null)
  assert.notEqual(await prisma.auditLog.findUnique({ where: { id: fresh } }), null)
})

test('retention: unlimited org keeps all logs', async () => {
  const orgId = await makeOrg('unlimited')
  const old = await seedLog(orgId, 400)
  await runAuditRetentionPurge()
  assert.notEqual(await prisma.auditLog.findUnique({ where: { id: old } }), null)
})

test('retention: orgless logs purged at 90-day default', async () => {
  const old = await seedLog(null, 100)
  const fresh = await seedLog(null, 10)
  await runAuditRetentionPurge()
  assert.equal(await prisma.auditLog.findUnique({ where: { id: old } }), null)
  assert.notEqual(await prisma.auditLog.findUnique({ where: { id: fresh } }), null)
})
