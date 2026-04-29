import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { provisionFromAssertion } from './jit-provisioning.service'
import { prisma } from '../../lib/prisma.lib'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrg(
  opts: {
    ssoEnabled?: boolean
    provider?: string | null
    emailDomains?: string[]
    roleMapping?: Record<string, string>
  } = {}
) {
  return prisma.organization.create({
    data: {
      name: `o-${randomUUID()}`,
      slug: `o-${randomUUID()}`,
      sso_enabled: opts.ssoEnabled ?? true,
      sso_provider: opts.provider === undefined ? 'saml' : opts.provider,
      sso_email_domains: opts.emailDomains ?? [],
      sso_role_mapping: opts.roleMapping ?? {},
    },
  })
}

test('jit: creates new user and member with default VIEWER role', async () => {
  const org = await makeOrg()
  const r = await provisionFromAssertion({
    email: `n-${randomUUID()}@x.io`,
    externalId: 'idp-sub-1',
    orgSlug: org.slug,
  })
  assert.equal(r.isNewUser, true)
  assert.equal(r.isNewMember, true)
  assert.equal(r.role, 'VIEWER')
})

test('jit: maps groups to ADMIN role', async () => {
  const org = await makeOrg({ roleMapping: { 'okta-admins': 'ADMIN' } })
  const r = await provisionFromAssertion({
    email: `a-${randomUUID()}@x.io`,
    externalId: 'idp-sub-2',
    groups: ['okta-admins'],
    orgSlug: org.slug,
  })
  assert.equal(r.role, 'ADMIN')
})

test('jit: rejects email outside sso_email_domains', async () => {
  const org = await makeOrg({ emailDomains: ['allowed.com'] })
  await assert.rejects(
    () =>
      provisionFromAssertion({
        email: `r-${randomUUID()}@notallowed.com`,
        externalId: 'idp-sub-3',
        orgSlug: org.slug,
      }),
    /not in this org's SSO allowlist/i
  )
})

test('jit: existing member role is updated to match assertion mapping', async () => {
  const org = await makeOrg({
    roleMapping: { editors: 'EDITOR', admins: 'ADMIN' },
  })
  const email = `e-${randomUUID()}@x.io`
  await provisionFromAssertion({
    email,
    externalId: 'sub-4',
    groups: ['editors'],
    orgSlug: org.slug,
  })
  const r2 = await provisionFromAssertion({
    email,
    externalId: 'sub-4',
    groups: ['admins'],
    orgSlug: org.slug,
  })
  assert.equal(r2.role, 'ADMIN')
  assert.equal(r2.isNewMember, false)
})

test('jit: sso disabled rejects', async () => {
  const org = await makeOrg({ ssoEnabled: false })
  await assert.rejects(
    () =>
      provisionFromAssertion({
        email: 'x@y.io',
        externalId: 'sub-5',
        orgSlug: org.slug,
      }),
    /SSO not enabled/i
  )
})
