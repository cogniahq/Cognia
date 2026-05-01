import test from 'node:test'
import assert from 'node:assert/strict'

import { qdrantClient, COLLECTION_NAME } from '../../lib/qdrant.lib'
import { searchQdrant } from './embedding-search.service'

test('memory search uses indexed user filters in Qdrant instead of enumerating memory ids', async () => {
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)
  const originalSearch = qdrantClient.search.bind(qdrantClient)

  let observedCollection: unknown = null
  let observedOptions: Record<string, unknown> | null = null

  qdrantClient.getCollections = (async () => ({
    collections: [{ name: COLLECTION_NAME }],
  })) as typeof qdrantClient.getCollections

  qdrantClient.getCollection = (async () => ({
    status: 'green',
    optimizer_status: 'ok',
    segments_count: 1,
    config: { params: { vectors: { size: 1536 } } },
    payload_schema: {
      memory_id: {},
      embedding_type: {},
      user_id: {},
      organization_id: {},
      source_type: {},
      document_id: {},
    },
  })) as unknown as typeof qdrantClient.getCollection

  qdrantClient.search = (async (
    collection: unknown,
    options: Record<string, unknown>
  ): Promise<Array<unknown>> => {
    observedCollection = collection
    observedOptions = options
    return []
  }) as unknown as typeof qdrantClient.search

  try {
    await searchQdrant(
      [0.25, 0.5, 0.75],
      {
        userId: 'user-123',
      },
      {
        searchStrategy: 'balanced',
        qdrantLimit: 15,
        maxResults: 10,
        semanticThreshold: 0.2,
        keywordThreshold: 0.1,
        coverageThreshold: 0.1,
        minScore: 0.15,
      }
    )

    assert.equal(observedCollection, COLLECTION_NAME)
    assert.deepEqual(observedOptions?.filter, {
      must: [{ key: 'user_id', match: { value: 'user-123' } }],
    })
    assert.equal(observedOptions?.limit, 15)
    assert.equal(observedOptions?.with_payload, true)
  } finally {
    qdrantClient.getCollections = originalGetCollections
    qdrantClient.getCollection = originalGetCollection
    qdrantClient.search = originalSearch
  }
})
