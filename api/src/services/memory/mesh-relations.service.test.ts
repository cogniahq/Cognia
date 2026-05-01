import test from 'node:test'
import assert from 'node:assert/strict'

import { RelationType } from '@prisma/client'

import { prisma } from '../../lib/prisma.lib'
import * as qdrantLib from '../../lib/qdrant.lib'
import { MeshRelationsService } from './mesh-relations.service'

type MemoryRelationCandidate = {
  id: string
  memory: { id: string }
  similarity_score: number
  similarity: number
  relation_type: string
}

type PrismaTestClient = {
  memory: {
    findUnique: typeof prisma.memory.findUnique
  }
  memoryRelation: {
    findUnique: typeof prisma.memoryRelation.findUnique
    findMany: typeof prisma.memoryRelation.findMany
    create: typeof prisma.memoryRelation.create
    createMany: typeof prisma.memoryRelation.createMany
    update: typeof prisma.memoryRelation.update
  }
}

type QdrantTestClient = {
  ensureCollection: () => Promise<void>
  qdrantClient: {
    getCollections: (...args: unknown[]) => Promise<{
      collections: Array<{ name: string }>
    }>
    getCollection: (...args: unknown[]) => Promise<{
      config?: { params?: { vectors?: { size?: number } } }
      payload_schema?: Record<string, unknown>
    }>
    createCollection: (...args: unknown[]) => Promise<unknown>
    createPayloadIndex: (...args: unknown[]) => Promise<unknown>
    search: (...args: unknown[]) => Promise<Array<unknown>>
  }
  COLLECTION_NAME: string
  EMBEDDING_DIMENSION: number
}

test('createMemoryRelations inserts relation candidates with duplicate-safe batch writes', async () => {
  const service = new MeshRelationsService()
  const prismaMock = prisma as unknown as PrismaTestClient
  const qdrantMock = qdrantLib as unknown as QdrantTestClient

  const originalMemoryFindUnique = prismaMock.memory.findUnique
  const originalRelationFindUnique = prismaMock.memoryRelation.findUnique
  const originalRelationFindMany = prismaMock.memoryRelation.findMany
  const originalRelationCreate = prismaMock.memoryRelation.create
  const originalRelationCreateMany = prismaMock.memoryRelation.createMany
  const originalRelationUpdate = prismaMock.memoryRelation.update
  const originalGetCollections = qdrantMock.qdrantClient.getCollections.bind(
    qdrantMock.qdrantClient
  )
  const originalGetCollection = qdrantMock.qdrantClient.getCollection.bind(qdrantMock.qdrantClient)
  const originalCreateCollection = qdrantMock.qdrantClient.createCollection.bind(
    qdrantMock.qdrantClient
  )
  const originalCreatePayloadIndex = qdrantMock.qdrantClient.createPayloadIndex.bind(
    qdrantMock.qdrantClient
  )
  const originalQdrantSearch = qdrantMock.qdrantClient.search.bind(qdrantMock.qdrantClient)

  let perRelationCreateCalls = 0
  let createManyArgs: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean } | null =
    null

  prismaMock.memory.findUnique = (async () =>
    ({
      id: 'memory-1',
      user_id: 'user-1',
      content: 'Base memory content',
      page_metadata: { topics: ['tax'] },
    }) as unknown) as unknown as typeof prisma.memory.findUnique

  prismaMock.memoryRelation.findUnique = (async (): Promise<null> =>
    null) as unknown as typeof prisma.memoryRelation.findUnique
  prismaMock.memoryRelation.findMany = (async (): Promise<
    Array<Record<string, unknown>>
  > => []) as unknown as typeof prisma.memoryRelation.findMany
  prismaMock.memoryRelation.create = (async () => {
    perRelationCreateCalls++
    return {}
  }) as unknown as typeof prisma.memoryRelation.create
  prismaMock.memoryRelation.createMany = (async (args: {
    data: Array<Record<string, unknown>>
    skipDuplicates?: boolean
  }) => {
    createManyArgs = {
      data: args.data as Array<Record<string, unknown>>,
      skipDuplicates: args.skipDuplicates,
    }
    return { count: Array.isArray(args.data) ? args.data.length : 0 }
  }) as unknown as typeof prisma.memoryRelation.createMany
  prismaMock.memoryRelation.update =
    (async () => ({})) as unknown as typeof prisma.memoryRelation.update

  qdrantMock.qdrantClient.getCollections = (async () => ({
    collections: [{ name: qdrantMock.COLLECTION_NAME }],
  })) as typeof qdrantMock.qdrantClient.getCollections
  qdrantMock.qdrantClient.getCollection = (async () => ({
    config: { params: { vectors: { size: qdrantMock.EMBEDDING_DIMENSION } } },
    payload_schema: {
      memory_id: {},
      embedding_type: {},
      user_id: {},
      organization_id: {},
      source_type: {},
      document_id: {},
    },
  })) as typeof qdrantMock.qdrantClient.getCollection
  qdrantMock.qdrantClient.createCollection =
    (async () => ({})) as typeof qdrantMock.qdrantClient.createCollection
  qdrantMock.qdrantClient.createPayloadIndex =
    (async () => ({})) as typeof qdrantMock.qdrantClient.createPayloadIndex
  qdrantMock.qdrantClient.search = (async (): Promise<
    Array<unknown>
  > => []) as unknown as typeof qdrantMock.qdrantClient.search
  ;(
    service as unknown as { findSemanticRelations: () => Promise<MemoryRelationCandidate[]> }
  ).findSemanticRelations = async (): Promise<MemoryRelationCandidate[]> => []
  ;(
    service as unknown as { findTopicalRelations: () => Promise<MemoryRelationCandidate[]> }
  ).findTopicalRelations = async (): Promise<MemoryRelationCandidate[]> => [
    {
      id: 'related-1',
      memory: { id: 'related-1' },
      similarity_score: 0.82,
      similarity: 0.82,
      relation_type: RelationType.topical,
    },
  ]
  ;(
    service as unknown as { findTemporalRelations: () => Promise<MemoryRelationCandidate[]> }
  ).findTemporalRelations = async (): Promise<MemoryRelationCandidate[]> => [
    {
      id: 'related-2',
      memory: { id: 'related-2' },
      similarity_score: 0.61,
      similarity: 0.61,
      relation_type: RelationType.temporal,
    },
  ]
  ;(
    service as unknown as {
      filterRelationsWithAI: (
        memory: unknown,
        relations: MemoryRelationCandidate[]
      ) => Promise<MemoryRelationCandidate[]>
    }
  ).filterRelationsWithAI = async (
    _memory: unknown,
    relations: MemoryRelationCandidate[]
  ): Promise<MemoryRelationCandidate[]> => relations
  ;(
    service as unknown as { cleanupLowQualityRelations: () => Promise<void> }
  ).cleanupLowQualityRelations = async (): Promise<void> => undefined

  try {
    await service.createMemoryRelations('memory-1', 'user-1')

    assert.equal(perRelationCreateCalls, 0)
    assert.deepEqual(createManyArgs, {
      data: [
        {
          memory_id: 'memory-1',
          related_memory_id: 'related-1',
          similarity_score: 0.82,
          relation_type: RelationType.topical,
        },
        {
          memory_id: 'memory-1',
          related_memory_id: 'related-2',
          similarity_score: 0.61,
          relation_type: RelationType.temporal,
        },
      ],
      skipDuplicates: true,
    })
  } finally {
    prismaMock.memory.findUnique = originalMemoryFindUnique
    prismaMock.memoryRelation.findUnique = originalRelationFindUnique
    prismaMock.memoryRelation.findMany = originalRelationFindMany
    prismaMock.memoryRelation.create = originalRelationCreate
    prismaMock.memoryRelation.createMany = originalRelationCreateMany
    prismaMock.memoryRelation.update = originalRelationUpdate
    qdrantMock.qdrantClient.getCollections = originalGetCollections
    qdrantMock.qdrantClient.getCollection = originalGetCollection
    qdrantMock.qdrantClient.createCollection = originalCreateCollection
    qdrantMock.qdrantClient.createPayloadIndex = originalCreatePayloadIndex
    qdrantMock.qdrantClient.search = originalQdrantSearch
  }
})
