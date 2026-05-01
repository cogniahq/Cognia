import test from 'node:test'
import assert from 'node:assert/strict'

// We test the RRF math at the module boundary by calling fuseRankings via the
// service's internal export path. Since fuseRankings is private, we test it
// through hybridSearch's contract: when both org and user rankings hit, the
// fused score for a memory present in both should exceed the score for a
// memory present in only one ranking.

import * as qdrantLib from '../../lib/qdrant.lib'
import { hybridSearch } from './hybrid-search.service'

test('hybridSearch fuses org+user rankings via RRF and orders correctly', async () => {
  const original = qdrantLib.searchHybrid

  // Mock searchHybrid to return synthetic rankings
  ;(qdrantLib as unknown as { searchHybrid: typeof qdrantLib.searchHybrid }).searchHybrid =
    (async (opts: { filter?: { must?: Array<{ key: string }> } }) => {
      const isUserScope = (opts.filter?.must || []).some(clause => clause.key === 'user_id')
      if (isUserScope) {
        return [
          { id: '1', score: 0.9, payload: { memory_id: 'mem-shared' } },
          { id: '2', score: 0.8, payload: { memory_id: 'mem-user-only' } },
        ]
      }
      return [
        { id: '3', score: 0.95, payload: { memory_id: 'mem-shared' } },
        { id: '4', score: 0.7, payload: { memory_id: 'mem-org-only' } },
      ]
    }) as typeof qdrantLib.searchHybrid

  try {
    const result = await hybridSearch({
      organizationId: 'org-1',
      userId: 'user-1',
      query: 'test query',
      queryEmbedding: [0.1, 0.2, 0.3],
      organizationLimit: 50,
      userLimit: 20,
    })

    assert.equal(result[0].memoryId, 'mem-shared')

    const sharedHit = result.find(r => r.memoryId === 'mem-shared')
    const userOnlyHit = result.find(r => r.memoryId === 'mem-user-only')
    const orgOnlyHit = result.find(r => r.memoryId === 'mem-org-only')

    assert.ok(sharedHit, 'mem-shared should be in fused results')
    assert.ok(userOnlyHit, 'mem-user-only should be in fused results')
    assert.ok(orgOnlyHit, 'mem-org-only should be in fused results')
    assert.ok(sharedHit!.score > userOnlyHit!.score, 'shared hit should outrank user-only via RRF')
    assert.ok(sharedHit!.score > orgOnlyHit!.score, 'shared hit should outrank org-only via RRF')
  } finally {
    ;(qdrantLib as unknown as { searchHybrid: typeof qdrantLib.searchHybrid }).searchHybrid =
      original
  }
})

test('hybridSearch returns empty array when both scopes return nothing', async () => {
  const original = qdrantLib.searchHybrid
  ;(qdrantLib as unknown as { searchHybrid: typeof qdrantLib.searchHybrid }).searchHybrid =
    (async () => []) as typeof qdrantLib.searchHybrid

  try {
    const result = await hybridSearch({
      organizationId: 'org-1',
      userId: 'user-1',
      query: 'test query',
      queryEmbedding: [0.1, 0.2, 0.3],
      organizationLimit: 50,
      userLimit: 20,
    })
    assert.deepEqual(result, [])
  } finally {
    ;(qdrantLib as unknown as { searchHybrid: typeof qdrantLib.searchHybrid }).searchHybrid =
      original
  }
})
