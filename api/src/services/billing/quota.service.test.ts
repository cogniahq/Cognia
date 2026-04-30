import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkSeatAvailable,
  checkIntegrationQuotaAvailable,
  getCurrentUsage,
} from './quota.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrg(planId = 'free') {
  const org = await prisma.organization.create({
    data: { name: `b-${randomUUID()}`, slug: `b-${randomUUID()}` },
  })
  await prisma.subscription.create({
    data: { organization_id: org.id, plan_id: planId, status: 'active' },
  })
  return org
}

test('quota: free plan rejects 2nd seat', async () => {
  const org = await makeOrg('free')
  const u = await prisma.user.create({ data: { email: `seat-${randomUUID()}@x.io` } })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: u.id, role: 'ADMIN' },
  })
  const check = await checkSeatAvailable(org.id)
  assert.equal(check.ok, false)
  assert.equal(check.reason, 'seats')
  assert.equal(check.limit, 1)
  assert.equal(check.plan, 'free')
})

test('quota: enterprise plan unlimited seats', async () => {
  const org = await makeOrg('enterprise')
  const u = await prisma.user.create({ data: { email: `e-${randomUUID()}@x.io` } })
  await prisma.organizationMember.create({
    data: { organization_id: org.id, user_id: u.id, role: 'ADMIN' },
  })
  const check = await checkSeatAvailable(org.id)
  assert.equal(check.ok, true)
  assert.equal(check.plan, 'enterprise')
})

test('quota: getCurrentUsage returns plan + counts', async () => {
  const org = await makeOrg('pro')
  const r = await getCurrentUsage(org.id)
  assert.equal(r.plan.id, 'pro')
  assert.ok('seats' in r.usage)
  assert.ok('memories' in r.usage)
  assert.ok('integrations' in r.usage)
  assert.equal(r.usage.seats.limit, 10)
})

test('quota: integrations check works for free plan with 0 active', async () => {
  const org = await makeOrg('free')
  const check = await checkIntegrationQuotaAvailable(org.id)
  assert.equal(check.ok, true)
  assert.equal(check.plan, 'free')
  assert.equal(check.limit, 1)
  assert.equal(check.current, 0)
})

test('quota: org with no subscription falls back to free plan', async () => {
  const org = await prisma.organization.create({
    data: { name: `b-${randomUUID()}`, slug: `b-${randomUUID()}` },
  })
  const r = await getCurrentUsage(org.id)
  assert.equal(r.plan.id, 'free')
})
