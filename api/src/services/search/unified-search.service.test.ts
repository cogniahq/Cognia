import test from 'node:test'
import assert from 'node:assert/strict'
import { SourceType } from '@prisma/client'

import { unifiedSearchService } from './unified-search.service'
import { aiProvider } from '../ai/ai-provider.service'
import { qdrantClient, COLLECTION_NAME } from '../../lib/qdrant.lib'
import { prisma } from '../../lib/prisma.lib'

test('organization search falls back to deterministic embeddings when provider calls fail', async () => {
  const fallbackVector = [0.25, 0.5, 0.75]
  const originalGenerateEmbedding = aiProvider.generateEmbedding
  const originalGenerateFallbackEmbedding = aiProvider.generateFallbackEmbedding
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)
  const originalSearch = qdrantClient.search.bind(qdrantClient)
  const originalCount = prisma.memory.count

  let fallbackUsed = false
  let searchVector: number[] | null = null

  aiProvider.generateEmbedding = (async () => {
    throw new Error('Connection error.')
  }) as typeof aiProvider.generateEmbedding

  aiProvider.generateFallbackEmbedding = ((text: string) => {
    fallbackUsed = true
    assert.equal(text, 'consent requirements and closing deliverables')
    return fallbackVector
  }) as typeof aiProvider.generateFallbackEmbedding

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
      matter_id: {},
      matter_ids: {},
      client_id: {},
      external_document_id: {},
    },
  })) as unknown as typeof qdrantClient.getCollection

  qdrantClient.search = (async (
    _collectionName: unknown,
    options: { limit?: number; vector?: unknown }
  ): Promise<Array<unknown>> => {
    searchVector = options.vector as number[]
    return []
  }) as unknown as typeof qdrantClient.search

  prisma.memory.count = (async () => 0) as typeof prisma.memory.count

  try {
    const result = await unifiedSearchService.search({
      organizationId: 'org-1',
      query: 'consent requirements and closing deliverables',
      includeAnswer: false,
    })

    assert.equal(fallbackUsed, true)
    assert.deepEqual(searchVector, fallbackVector)
    assert.deepEqual(result, {
      results: [],
      totalResults: 0,
    })
  } finally {
    aiProvider.generateEmbedding = originalGenerateEmbedding
    aiProvider.generateFallbackEmbedding = originalGenerateFallbackEmbedding
    qdrantClient.getCollections = originalGetCollections
    qdrantClient.getCollection = originalGetCollection
    qdrantClient.search = originalSearch
    prisma.memory.count = originalCount
  }
})

test('organization search returns every matching result when no limit is provided', async () => {
  const originalGenerateEmbedding = aiProvider.generateEmbedding
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)
  const originalSearch = qdrantClient.search.bind(qdrantClient)
  const originalCount = prisma.memory.count
  const originalFindMany = prisma.memory.findMany

  const totalMatches = 25
  const memoryIds = Array.from({ length: totalMatches }, (_, index) => `memory-${index + 1}`)
  let observedLimit: number | null = null

  aiProvider.generateEmbedding = (async () => [
    0.1, 0.2, 0.3,
  ]) as typeof aiProvider.generateEmbedding

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
      matter_id: {},
      matter_ids: {},
      client_id: {},
      external_document_id: {},
    },
  })) as unknown as typeof qdrantClient.getCollection

  qdrantClient.search = (async (_collectionName: unknown, options: { limit?: number }) => {
    observedLimit = options.limit as number
    return memoryIds.map((memoryId, index) => ({
      id: memoryId,
      version: 1,
      score: 1 - index * 0.01,
      payload: { memory_id: memoryId },
    }))
  }) as unknown as typeof qdrantClient.search

  prisma.memory.count = (async () => totalMatches) as typeof prisma.memory.count

  prisma.memory.findMany = (async () =>
    memoryIds.map((memoryId, index) => ({
      id: memoryId,
      title: `Result ${index + 1}`,
      content: `Content ${index + 1}`,
      page_metadata: null as Record<string, unknown> | null,
      source_type: 'DOCUMENT',
      url: null as string | null,
      document_chunks: [] as Array<unknown>,
    }))) as unknown as typeof prisma.memory.findMany

  try {
    const result = await unifiedSearchService.search({
      organizationId: 'org-1',
      query: 'payment terms',
      includeAnswer: false,
    })

    assert.equal(observedLimit, totalMatches)
    assert.equal(result.results.length, totalMatches)
    assert.equal(result.totalResults, totalMatches)
  } finally {
    aiProvider.generateEmbedding = originalGenerateEmbedding
    qdrantClient.getCollections = originalGetCollections
    qdrantClient.getCollection = originalGetCollection
    qdrantClient.search = originalSearch
    prisma.memory.count = originalCount
    prisma.memory.findMany = originalFindMany
  }
})

test('organization summary answer uses retrieved content when the preview omits the answer', async () => {
  const originalGenerateContent = aiProvider.generateContent

  let observedPrompt = ''

  aiProvider.generateContent = (async (prompt: string) => {
    observedPrompt = prompt

    if (prompt.includes('twenty-four hours after confirmation of a security incident')) {
      return '## Breach Notification Timeline\n\n- Aperture Cloud will notify Northstar Bank within twenty-four hours after confirmation of a security incident. [1]'
    }

    return 'The provided context does not contain information regarding the breach notification timeline.'
  }) as typeof aiProvider.generateContent

  try {
    const answerResult = await (
      unifiedSearchService as unknown as {
        generateAnswer: (
          query: string,
          results: Array<{
            memoryId: string
            documentName?: string
            pageNumber?: number
            content: string
            contentPreview: string
            score: number
            sourceType: SourceType
            title?: string
            url?: string
          }>
        ) => Promise<{
          answer: string
          citations: Array<{
            index: number
            documentName?: string
            pageNumber?: number
            memoryId: string
            url?: string
            sourceType?: SourceType
          }>
        }>
      }
    ).generateAnswer('What is the breach notification timeline?', [
      {
        memoryId: 'memory-1',
        documentName: '07_security_questionnaire_response.txt',
        pageNumber: 1,
        content:
          'Title: 07_security_questionnaire_response.txt - Chunk 1\nQ: What is the breach notification commitment?\nA: Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data.',
        contentPreview:
          '07_security_questionnaire_response.txt - Chunk 1. SECURITY QUESTIONNAIRE RESPONSE submitted by Aperture Cloud Security Team.',
        score: 0.99,
        sourceType: SourceType.DOCUMENT,
        title: '07_security_questionnaire_response.txt - Chunk 1',
      },
    ])

    assert.match(observedPrompt, /twenty-four hours after confirmation of a security incident/)
    assert.match(observedPrompt, /Return GitHub-flavored Markdown/i)
    assert.equal(
      answerResult.answer,
      '## Breach Notification Timeline\n\n- Aperture Cloud will notify Northstar Bank within twenty-four hours after confirmation of a security incident. [1]'
    )
    assert.deepEqual(answerResult.citations, [
      {
        index: 1,
        documentName: '07_security_questionnaire_response.txt',
        pageNumber: 1,
        memoryId: 'memory-1',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
    ])
  } finally {
    aiProvider.generateContent = originalGenerateContent
  }
})

test('organization summary answer only includes the highest-ranked evidence slices in the prompt', async () => {
  const originalGenerateContent = aiProvider.generateContent

  let observedPrompt = ''

  aiProvider.generateContent = (async (prompt: string) => {
    observedPrompt = prompt
    return 'Top answer [1] [12]'
  }) as typeof aiProvider.generateContent

  try {
    const answerResult = await (
      unifiedSearchService as unknown as {
        generateAnswer: (
          query: string,
          results: Array<{
            memoryId: string
            documentName?: string
            pageNumber?: number
            content: string
            contentPreview: string
            score: number
            sourceType: SourceType
            title?: string
            url?: string
          }>
        ) => Promise<{
          answer: string
          citations: Array<{
            index: number
            documentName?: string
            pageNumber?: number
            memoryId: string
            url?: string
            sourceType?: SourceType
          }>
        }>
      }
    ).generateAnswer(
      'Show the implementation milestones.',
      Array.from({ length: 15 }, (_, index) => ({
        memoryId: `memory-${index + 1}`,
        documentName: `Implementation Plan ${index + 1}.pdf`,
        pageNumber: index + 1,
        content: `Milestone ${index + 1} is captured here with detailed delivery information.`,
        contentPreview: `Preview ${index + 1}`,
        score: 1 - index * 0.01,
        sourceType: SourceType.DOCUMENT,
        title: `Implementation Plan ${index + 1}`,
      }))
    )

    assert.match(observedPrompt, /\[1\] Document: Implementation Plan 1\.pdf/)
    assert.match(observedPrompt, /\[12\] Document: Implementation Plan 12\.pdf/)
    assert.doesNotMatch(observedPrompt, /\[13\] Document: Implementation Plan 13\.pdf/)
    assert.equal(answerResult.answer, 'Top answer [1] [12]')
    assert.deepEqual(answerResult.citations, [
      {
        index: 1,
        documentName: 'Implementation Plan 1.pdf',
        pageNumber: 1,
        memoryId: 'memory-1',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
      {
        index: 12,
        documentName: 'Implementation Plan 12.pdf',
        pageNumber: 12,
        memoryId: 'memory-12',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
    ])
  } finally {
    aiProvider.generateContent = originalGenerateContent
  }
})
