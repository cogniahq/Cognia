import test from 'node:test'
import assert from 'node:assert/strict'

import { unifiedSearchService } from './unified-search.service'
import { aiProvider } from '../ai/ai-provider.service'
import { qdrantClient, COLLECTION_NAME } from '../../lib/qdrant.lib'

test('organization search fails loud when embedding provider is unavailable', async () => {
  const originalGenerateEmbedding = aiProvider.generateEmbedding
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)

  aiProvider.generateEmbedding = (async () => {
    throw new Error('Connection error.')
  }) as typeof aiProvider.generateEmbedding

  qdrantClient.getCollections = (async () => ({
    collections: [{ name: COLLECTION_NAME }],
  })) as typeof qdrantClient.getCollections

  qdrantClient.getCollection = (async () => ({
    status: 'green',
    optimizer_status: 'ok',
    segments_count: 1,
    config: { params: { vectors: { dense_content: { size: 1536 } } } },
    payload_schema: {
      memory_id: {},
      organization_id: {},
      user_id: {},
    },
  })) as unknown as typeof qdrantClient.getCollection

  try {
    await assert.rejects(
      () =>
        unifiedSearchService.search({
          organizationId: 'org-1',
          query: 'consent requirements and closing deliverables',
          includeAnswer: false,
          limit: 5,
        }),
      /Connection error/
    )
  } finally {
    aiProvider.generateEmbedding = originalGenerateEmbedding
    qdrantClient.getCollections = originalGetCollections
    qdrantClient.getCollection = originalGetCollection
  }
})
