import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getEffectivePermissions, can, canAny, canAll } from './permissions.service'
import { prisma } from '../../lib/prisma.lib'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrgWithMember(role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
  const u = await prisma.user.create({
    data: { email: `p-${randomUUID()}@x.io` },
  })
  const slug = `p-${randomUUID()}`
  const o = await prisma.organization.create({
    data: { name: slug, slug },
  })
  await prisma.organizationMember.create({
    data: { organization_id: o.id, user_id: u.id, role },
  })
  return { user: u, org: o }
}

test('permissions: VIEWER has read perms only, no writes', async () => {
  const { user, org } = await makeOrgWithMember('VIEWER')
  const perms = await getEffectivePermissions(user.id, org.id)
  assert.ok(perms.includes('memory.read'))
  assert.ok(perms.includes('memory.comment'))
  assert.ok(perms.includes('audit.read'))
  assert.ok(!perms.includes('memory.write'))
  assert.ok(!perms.includes('memory.delete'))
  assert.ok(!perms.includes('billing.manage'))
  assert.ok(!perms.includes('member.invite'))
})

test('permissions: EDITOR has writes but not admin perms', async () => {
  const { user, org } = await makeOrgWithMember('EDITOR')
  const perms = await getEffectivePermissions(user.id, org.id)
  assert.ok(perms.includes('memory.write'))
  assert.ok(perms.includes('memory.delete'))
  assert.ok(perms.includes('memory.bulk_delete'))
  assert.ok(perms.includes('memory.share'))
  assert.ok(!perms.includes('member.remove'))
  assert.ok(!perms.includes('billing.manage'))
  assert.ok(!perms.includes('legal_hold.apply'))
})

test('permissions: ADMIN has every permission', async () => {
  const { user, org } = await makeOrgWithMember('ADMIN')
  const perms = await getEffectivePermissions(user.id, org.id)
  assert.ok(perms.includes('billing.manage'))
  assert.ok(perms.includes('billing.cancel'))
  assert.ok(perms.includes('legal_hold.apply'))
  assert.ok(perms.includes('sso.configure'))
  assert.ok(perms.includes('scim.manage'))
  assert.ok(perms.includes('member.remove'))
  assert.ok(perms.includes('audit.export'))
  assert.ok(perms.includes('llm.configure'))
})

test('permissions: deactivated member has no permissions', async () => {
  const { user, org } = await makeOrgWithMember('ADMIN')
  await prisma.organizationMember.updateMany({
    where: { user_id: user.id, organization_id: org.id },
    data: { deactivated_at: new Date() },
  })
  const perms = await getEffectivePermissions(user.id, org.id)
  assert.equal(perms.length, 0)
})

test('permissions: personal account gets personal permissions', async () => {
  const u = await prisma.user.create({
    data: { email: `pers-${randomUUID()}@x.io` },
  })
  const perms = await getEffectivePermissions(u.id, null)
  assert.ok(perms.includes('memory.write'))
  assert.ok(perms.includes('integration.connect'))
  assert.ok(perms.includes('api_key.create'))
  // No org-scoped permissions for a personal account
  assert.ok(!perms.includes('member.invite'))
  assert.ok(!perms.includes('legal_hold.apply'))
  assert.ok(!perms.includes('audit.read'))
})

test('permissions: Cognia staff (UserRole.ADMIN) gets every perm regardless of org', async () => {
  const u = await prisma.user.create({
    data: { email: `staff-${randomUUID()}@x.io`, role: 'ADMIN' },
  })
  const personal = await getEffectivePermissions(u.id, null)
  assert.ok(personal.includes('legal_hold.apply'))
  assert.ok(personal.includes('ediscovery.search'))
  assert.ok(personal.includes('member.remove'))
  // Even with a non-existent org id, staff gets full permissions before any
  // membership lookup happens.
  const fakeOrg = await getEffectivePermissions(u.id, randomUUID())
  assert.ok(fakeOrg.includes('billing.manage'))
})

test('permissions: can() / canAny() / canAll() helpers return booleans', async () => {
  const { user, org } = await makeOrgWithMember('VIEWER')
  assert.equal(await can(user.id, org.id, 'memory.read'), true)
  assert.equal(await can(user.id, org.id, 'memory.write'), false)
  assert.equal(await canAny(user.id, org.id, 'memory.write', 'memory.read'), true)
  assert.equal(await canAny(user.id, org.id, 'memory.write', 'billing.manage'), false)
  assert.equal(await canAll(user.id, org.id, 'memory.read', 'memory.comment'), true)
  assert.equal(await canAll(user.id, org.id, 'memory.read', 'memory.write'), false)
})
