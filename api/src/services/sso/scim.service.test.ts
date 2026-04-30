import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { listUsers, createUser, patchUser, deleteUser } from './scim.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

async function makeOrg() {
  return prisma.organization.create({
    data: { name: `s-${randomUUID()}`, slug: `s-${randomUUID()}` },
  })
}

test('scim: createUser provisions org member', async () => {
  const org = await makeOrg()
  const email = `n-${randomUUID()}@x.io`
  const u = await createUser(
    org.id,
    {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: email,
      emails: [{ value: email, primary: true }],
      active: true,
    },
    'http://t/scim/v2',
    { actorUserId: null, actorEmail: null }
  )
  assert.equal(u.active, true)
  assert.match(u.userName, /@x\.io$/)
})

test('scim: PATCH active=false deactivates member', async () => {
  const org = await makeOrg()
  const email = `p-${randomUUID()}@x.io`
  const u = await createUser(
    org.id,
    {
      userName: email,
      emails: [{ value: email, primary: true }],
      active: true,
    },
    'http://t/scim/v2',
    { actorUserId: null, actorEmail: null }
  )
  const out = await patchUser(
    org.id,
    u.id,
    [{ op: 'replace', path: 'active', value: false }],
    'http://t/scim/v2',
    { actorUserId: null, actorEmail: null }
  )
  assert.equal(out?.active, false)
})

test('scim: list filters by emails.value', async () => {
  const org = await makeOrg()
  const email = `f-${randomUUID()}@x.io`
  await createUser(
    org.id,
    { userName: email, emails: [{ value: email, primary: true }], active: true },
    'http://t/scim/v2',
    { actorUserId: null, actorEmail: null }
  )
  const list = await listUsers(org.id, { filter: `emails.value eq "${email}"` }, 'http://t/scim/v2')
  assert.equal(list.totalResults, 1)
})

test('scim: delete removes the row', async () => {
  const org = await makeOrg()
  const email = `d-${randomUUID()}@x.io`
  const u = await createUser(
    org.id,
    {
      userName: email,
      emails: [{ value: email, primary: true }],
      active: true,
    },
    'http://t/scim/v2',
    { actorUserId: null, actorEmail: null }
  )
  const ok = await deleteUser(org.id, u.id, { actorUserId: null, actorEmail: null })
  assert.equal(ok, true)
})
