import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSavedSearch,
  listSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
} from './saved-search.service'
import { prisma } from '../../lib/prisma.lib'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('saved-search: create + list + update + delete', async () => {
  const u = await prisma.user.create({ data: { email: `ss-${randomUUID()}@x.io` } })
  const s = await createSavedSearch({
    userId: u.id,
    name: 'AI papers',
    query: 'attention is all you need',
  })
  const list = await listSavedSearches(u.id)
  assert.equal(list.length, 1)
  const updated = await updateSavedSearch(s.id, u.id, {
    alertEnabled: true,
    alertFrequency: 'weekly',
  })
  assert.equal(updated.alert_enabled, true)
  await deleteSavedSearch(s.id, u.id)
  assert.equal((await listSavedSearches(u.id)).length, 0)
})
