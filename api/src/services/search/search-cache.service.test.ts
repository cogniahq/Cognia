import test from 'node:test'
import assert from 'node:assert/strict'
import { SourceType } from '@prisma/client'
import { searchCache } from './search-cache.service'

test('search cache key is deterministic across query whitespace and case', () => {
  const a = searchCache.buildKey({
    organizationId: 'org-1',
    query: 'How does indemnity work?',
    finalLimit: 10,
  })
  const b = searchCache.buildKey({
    organizationId: 'org-1',
    query: '  HOW   does Indemnity work?  ',
    finalLimit: 10,
  })
  assert.equal(a, b)
})

test('search cache key changes with org, user scope, and sourceTypes', () => {
  const base = {
    organizationId: 'org-1',
    query: 'q',
    finalLimit: 10,
  }
  const k1 = searchCache.buildKey(base)
  const k2 = searchCache.buildKey({ ...base, organizationId: 'org-2' })
  const k3 = searchCache.buildKey({ ...base, userId: 'user-1' })
  const k4 = searchCache.buildKey({ ...base, sourceTypes: [SourceType.DOCUMENT] })

  const keys = new Set([k1, k2, k3, k4])
  assert.equal(keys.size, 4)
})

test('search cache key is stable regardless of sourceTypes order', () => {
  const a = searchCache.buildKey({
    organizationId: 'org-1',
    query: 'q',
    finalLimit: 10,
    sourceTypes: [SourceType.DOCUMENT, SourceType.INTEGRATION],
  })
  const b = searchCache.buildKey({
    organizationId: 'org-1',
    query: 'q',
    finalLimit: 10,
    sourceTypes: [SourceType.INTEGRATION, SourceType.DOCUMENT],
  })
  assert.equal(a, b)
})
