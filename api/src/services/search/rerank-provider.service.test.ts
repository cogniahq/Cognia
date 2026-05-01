import test from 'node:test'
import assert from 'node:assert/strict'
import { rerankProvider } from './rerank-provider.service'

test('rerank passthrough preserves order and assigns descending scores', async () => {
  const original = process.env.RERANK_PROVIDER
  process.env.RERANK_PROVIDER = 'passthrough'

  try {
    const docs = [
      { id: 'a', text: 'first' },
      { id: 'b', text: 'second' },
      { id: 'c', text: 'third' },
    ]

    const result = await rerankProvider.rerank({ query: 'irrelevant', documents: docs, topN: 2 })

    assert.equal(result.length, 2)
    assert.equal(result[0].id, 'a')
    assert.equal(result[1].id, 'b')
    assert.ok(result[0].score > result[1].score)
  } finally {
    if (original === undefined) delete process.env.RERANK_PROVIDER
    else process.env.RERANK_PROVIDER = original
  }
})

test('rerank short-circuits empty input', async () => {
  const result = await rerankProvider.rerank({ query: 'q', documents: [], topN: 5 })
  assert.deepEqual(result, [])
})

test('rerank returns single doc with full score when only one candidate', async () => {
  const result = await rerankProvider.rerank({
    query: 'q',
    documents: [{ id: 'x', text: 't' }],
    topN: 5,
  })
  assert.deepEqual(result, [{ id: 'x', score: 1 }])
})
