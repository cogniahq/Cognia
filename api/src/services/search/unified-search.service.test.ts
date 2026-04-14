import test from 'node:test'
import assert from 'node:assert/strict'
import { SourceType } from '@prisma/client'

import { unifiedSearchService } from './unified-search.service'
import { aiProvider } from '../ai/ai-provider.service'
import { qdrantClient, COLLECTION_NAME } from '../../lib/qdrant.lib'
import { prisma } from '../../lib/prisma.lib'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const searchJobService = require('./search-job.service') as typeof import('./search-job.service')

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

test('organization search returns a verbatim highlight excerpt alongside retrieval text', async () => {
  const originalGenerateEmbedding = aiProvider.generateEmbedding
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)
  const originalSearch = qdrantClient.search.bind(qdrantClient)
  const originalCount = prisma.memory.count
  const originalFindMany = prisma.memory.findMany

  aiProvider.generateEmbedding = (async () => [0.1, 0.2, 0.3]) as typeof aiProvider.generateEmbedding

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

  qdrantClient.search = (async () => [
    {
      id: 'memory-1',
      version: 1,
      score: 0.98,
      payload: { memory_id: 'memory-1' },
    },
  ]) as unknown as typeof qdrantClient.search

  prisma.memory.count = (async () => 1) as typeof prisma.memory.count

  prisma.memory.findMany = (async () => [
    {
      id: 'memory-1',
      title: 'Fil-Pin Zoom Plugin',
      content:
        'The plugin captures Zoom meetings, stores transcripts, and syncs the resulting notes into the workspace for later retrieval.',
      page_metadata: {
        structuredSummary:
          'Structured summary: the plugin captures meetings, provides searchable transcripts, and stores workspace artifacts for retrieval.',
        representativeExcerpt:
          'The plugin captures Zoom meetings, stores transcripts, and syncs the resulting notes into the workspace for later retrieval.',
      } as Record<string, unknown>,
      source_type: 'INTEGRATION',
      url: 'https://www.notion.so/fil-pin-zoom-plugin-demo',
      document_chunks: [] as Array<unknown>,
    },
  ]) as unknown as typeof prisma.memory.findMany

  try {
    const result = await unifiedSearchService.search({
      organizationId: 'org-1',
      query: 'What does the Fil-Pin Zoom Plugin say about data capture, transcripts, and storage?',
      includeAnswer: false,
    })

    assert.equal(result.results.length, 1)
    assert.match(result.results[0]?.content || '', /Structured summary:/)
    assert.equal(
      result.results[0]?.highlightText,
      'The plugin captures Zoom meetings, stores transcripts, and syncs the resulting notes into the workspace for later retrieval.'
    )
  } finally {
    aiProvider.generateEmbedding = originalGenerateEmbedding
    qdrantClient.getCollections = originalGetCollections
    qdrantClient.getCollection = originalGetCollection
    qdrantClient.search = originalSearch
    prisma.memory.count = originalCount
    prisma.memory.findMany = originalFindMany
  }
})

test('organization search applies structured metadata filters to organization results', async () => {
  const originalGenerateEmbedding = aiProvider.generateEmbedding
  const originalGetCollections = qdrantClient.getCollections.bind(qdrantClient)
  const originalGetCollection = qdrantClient.getCollection.bind(qdrantClient)
  const originalSearch = qdrantClient.search.bind(qdrantClient)
  const originalCount = prisma.memory.count
  const originalFindMany = prisma.memory.findMany

  aiProvider.generateEmbedding = (async () => [0.1, 0.2, 0.3]) as typeof aiProvider.generateEmbedding

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

  qdrantClient.search = (async () => [
    {
      id: 'memory-1',
      version: 1,
      score: 0.99,
      payload: { memory_id: 'memory-1' },
    },
    {
      id: 'memory-2',
      version: 1,
      score: 0.96,
      payload: { memory_id: 'memory-2' },
    },
  ]) as unknown as typeof qdrantClient.search

  prisma.memory.count = (async () => 2) as typeof prisma.memory.count

  prisma.memory.findMany = (async () => [
    {
      id: 'memory-1',
      title: 'ITO v. Example Assessee',
      content: 'ITAT held in favour of the assessee on the merits.',
      page_metadata: {
        domainPack: 'ca-firm',
        artifactType: 'case-law',
        authority: 'itat',
        outcome: 'favourable',
      } as Record<string, unknown>,
      source_type: 'DOCUMENT',
      url: null as string | null,
      document_chunks: [
        {
          chunk_index: 0,
          page_number: 3,
          document: {
            id: 'document-1',
            original_name: 'ITO v. Example Assessee.pdf',
          },
        },
      ],
    },
    {
      id: 'memory-2',
      title: 'CIT v. Example Revenue',
      content: 'High Court ruled against the assessee.',
      page_metadata: {
        domainPack: 'ca-firm',
        artifactType: 'case-law',
        authority: 'high-court',
        outcome: 'unfavourable',
      } as Record<string, unknown>,
      source_type: 'DOCUMENT',
      url: null as string | null,
      document_chunks: [
        {
          chunk_index: 0,
          page_number: 7,
          document: {
            id: 'document-2',
            original_name: 'CIT v. Example Revenue.pdf',
          },
        },
      ],
    },
  ]) as unknown as typeof prisma.memory.findMany

  try {
    const result = await unifiedSearchService.search({
      organizationId: 'org-1',
      query: 'find favourable case law for the assessee',
      includeAnswer: false,
      metadataFilters: {
        artifactTypes: ['case-law'],
        authorities: ['itat'],
        outcomes: ['favourable'],
      },
    })

    assert.equal(result.results.length, 1)
    assert.equal(result.totalResults, 1)
    assert.equal(result.results[0]?.memoryId, 'memory-1')
    assert.equal(
      (result.results[0]?.metadata as Record<string, unknown> | undefined)?.authority,
      'itat'
    )
    assert.equal(
      (result.results[0]?.metadata as Record<string, unknown> | undefined)?.outcome,
      'favourable'
    )
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

test('organization summary answer uses full answer content when the relevant configuration is buried beyond retrieval text', async () => {
  const originalGenerateContent = aiProvider.generateContent

  let observedPrompt = ''

  aiProvider.generateContent = (async (prompt: string) => {
    observedPrompt = prompt

    if (prompt.includes('314159 (0x4cb2f)') && prompt.includes('https://api.node.glif.io/rpc')) {
      return '## Calibration Config\n\n- The notes list the Calibration RPC as `https://api.node.glif.io/rpc` and the FEVM chain ID as `314159 (0x4cb2f)`. [1]'
    }

    return 'The provided context does not include any information regarding the exact FEVM chain ID and RPC endpoint for Calibration.'
  }) as typeof aiProvider.generateContent

  const longPdpContent =
    'Hackathon Details. '.repeat(40) +
    'Calibration network references. API: https://api.node.glif.io/rpc (see testnet column). FEVM Chain ID: 314159 (0x4cb2f). Explorer: https://calibration.pdp-explorer.eng.filoz.org/.'

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
            answerContent?: string
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
      'In the Filecoin PDP hackathon notes, what exact FEVM chain ID and RPC endpoint are listed for Calibration?',
      [
        {
          memoryId: 'memory-1',
          documentName: 'FWS Hackathon 1: Hack w/ a simple PDP service',
          pageNumber: 1,
          content:
            'Title: FWS Hackathon 1: Hack w/ a simple PDP service\nSummary: PDP hackathon overview and Filecoin builder tooling notes.\nExcerpt: The hackathon gives the new PDP service a serious workout before launch.',
          contentPreview: 'PDP hackathon overview and Filecoin builder tooling notes.',
          answerContent: longPdpContent,
          score: 0.99,
          sourceType: SourceType.INTEGRATION,
          title: 'FWS Hackathon 1: Hack w/ a simple PDP service',
        },
      ]
    )

    assert.match(observedPrompt, /314159 \(0x4cb2f\)/)
    assert.match(observedPrompt, /https:\/\/api\.node\.glif\.io\/rpc/)
    assert.equal(
      answerResult.answer,
      '## Calibration Config\n\n- The notes list the Calibration RPC as `https://api.node.glif.io/rpc` and the FEVM chain ID as `314159 (0x4cb2f)`. [1]'
    )
    assert.deepEqual(answerResult.citations, [
      {
        index: 1,
        documentName: 'FWS Hackathon 1: Hack w/ a simple PDP service',
        pageNumber: 1,
        memoryId: 'memory-1',
        url: undefined,
        sourceType: SourceType.INTEGRATION,
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

test('organization summary answer caps the total prompt context for large retrieval sets', async () => {
  const originalGenerateContent = aiProvider.generateContent

  let observedPrompt = ''

  aiProvider.generateContent = (async (prompt: string) => {
    observedPrompt = prompt
    return 'Scoped answer [1] [4]'
  }) as typeof aiProvider.generateContent

  try {
    const oversizedContent = 'Security controls and implementation detail. '.repeat(120)

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
      'Show the implementation milestones and approvals.',
      Array.from({ length: 12 }, (_, index) => ({
        memoryId: `memory-${index + 1}`,
        documentName: `Implementation Plan ${index + 1}.pdf`,
        pageNumber: index + 1,
        content: oversizedContent,
        contentPreview: `Preview ${index + 1}`,
        score: 1 - index * 0.01,
        sourceType: SourceType.DOCUMENT,
        title: `Implementation Plan ${index + 1}`,
      }))
    )

    assert.match(observedPrompt, /\[1\] Document: Implementation Plan 1\.pdf/)
    assert.ok(
      observedPrompt.length < 5000,
      `expected capped prompt under 5000 chars, received ${observedPrompt.length}`
    )
    assert.equal(answerResult.answer, 'Scoped answer [1] [4]')
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
        index: 4,
        documentName: 'Implementation Plan 4.pdf',
        pageNumber: 4,
        memoryId: 'memory-4',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
    ])
  } finally {
    aiProvider.generateContent = originalGenerateContent
  }
})

test('organization summary answer diversifies sources before taking multiple chunks from the same file', async () => {
  const originalGenerateContent = aiProvider.generateContent

  let observedPrompt = ''

  aiProvider.generateContent = (async (prompt: string) => {
    observedPrompt = prompt
    return 'Diversified answer [1] [2] [3]'
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
    ).generateAnswer('Show the implementation milestones and approvals.', [
      {
        memoryId: 'memory-a-1',
        documentName: 'Implementation Plan A.pdf',
        pageNumber: 1,
        content: 'Implementation milestones, approvals, and go-live gates.',
        contentPreview: 'Implementation milestones preview',
        score: 0.99,
        sourceType: SourceType.DOCUMENT,
        title: 'Implementation Plan A - Chunk 1',
      },
      {
        memoryId: 'memory-a-2',
        documentName: 'Implementation Plan A.pdf',
        pageNumber: 2,
        content: 'Implementation milestones, approvals, and launch dependencies.',
        contentPreview: 'Implementation approvals preview',
        score: 0.98,
        sourceType: SourceType.DOCUMENT,
        title: 'Implementation Plan A - Chunk 2',
      },
      {
        memoryId: 'memory-b-1',
        documentName: 'Implementation Plan B.pdf',
        pageNumber: 4,
        content: 'Implementation milestones, approvals, and security sign-off.',
        contentPreview: 'Implementation security preview',
        score: 0.94,
        sourceType: SourceType.DOCUMENT,
        title: 'Implementation Plan B - Chunk 1',
      },
      {
        memoryId: 'memory-c-1',
        documentName: 'Implementation Plan C.pdf',
        pageNumber: 6,
        content: 'Implementation milestones, approvals, and production readiness.',
        contentPreview: 'Implementation readiness preview',
        score: 0.93,
        sourceType: SourceType.DOCUMENT,
        title: 'Implementation Plan C - Chunk 1',
      },
    ])

    assert.match(
      observedPrompt,
      /\[1\] Document: Implementation Plan A\.pdf[\s\S]*\[2\] Document: Implementation Plan B\.pdf[\s\S]*\[3\] Document: Implementation Plan C\.pdf/
    )
    assert.doesNotMatch(observedPrompt, /\[2\] Document: Implementation Plan A\.pdf/)
    assert.equal(answerResult.answer, 'Diversified answer [1] [2] [3]')
    assert.deepEqual(answerResult.citations, [
      {
        index: 1,
        documentName: 'Implementation Plan A.pdf',
        pageNumber: 1,
        memoryId: 'memory-a-1',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
      {
        index: 2,
        documentName: 'Implementation Plan B.pdf',
        pageNumber: 4,
        memoryId: 'memory-b-1',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
      {
        index: 3,
        documentName: 'Implementation Plan C.pdf',
        pageNumber: 6,
        memoryId: 'memory-c-1',
        url: undefined,
        sourceType: SourceType.DOCUMENT,
      },
    ])
  } finally {
    aiProvider.generateContent = originalGenerateContent
  }
})

test('organization answer job completes with a fallback summary when generation is rate limited', async () => {
  const originalGenerateContent = aiProvider.generateContent
  const originalSetSearchJobResult = searchJobService.setSearchJobResult

  const updates: Array<{
    jobId: string
    data: Parameters<typeof searchJobService.setSearchJobResult>[1]
  }> = []

  aiProvider.generateContent = (async () => {
    const error = new Error(
      '429 Rate limit reached for gpt-4o-mini on requests per min (RPM): Limit 3, Used 3, Requested 1.'
    ) as Error & { status?: number }
    error.status = 429
    throw error
  }) as typeof aiProvider.generateContent

  searchJobService.setSearchJobResult = (async (
    jobId: string,
    data: Parameters<typeof searchJobService.setSearchJobResult>[1]
  ) => {
    updates.push({ jobId, data })
  }) as typeof searchJobService.setSearchJobResult

  try {
    await (
      unifiedSearchService as unknown as {
        generateAnswerAsync: (
          jobId: string,
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
        ) => Promise<void>
      }
    ).generateAnswerAsync('job-1', 'What are the implementation milestones?', [
      {
        memoryId: 'memory-1',
        documentName: 'Implementation Plan.pdf',
        pageNumber: 3,
        content: 'Milestone one covers kickoff, security review, and go-live approval.',
        contentPreview: 'Implementation Plan preview',
        score: 0.98,
        sourceType: SourceType.DOCUMENT,
        title: 'Implementation Plan',
      },
    ])

    assert.equal(updates.length, 1)
    assert.equal(updates[0]?.jobId, 'job-1')
    assert.equal(updates[0]?.data.status, 'completed')
    assert.match(String(updates[0]?.data.answer), /summary unavailable|rate-limit|retrieved sources/i)
  } finally {
    aiProvider.generateContent = originalGenerateContent
    searchJobService.setSearchJobResult = originalSetSearchJobResult
  }
})

test('organization summary answer uses compact chunked evidence and the search generation path for large legal queries', async () => {
  const originalGenerateContent = aiProvider.generateContent

  const calls: Array<{ prompt: string; isSearchRequest: boolean | undefined }> = []

  aiProvider.generateContent = (async (prompt: string, isSearchRequest?: boolean) => {
    calls.push({ prompt, isSearchRequest })

    assert.equal(isSearchRequest, true)
    assert.match(prompt, /50C/i)
    assert.match(prompt, /54F/i)
    assert.match(prompt, /69B/i)
    assert.ok(
      prompt.length < 5000,
      `expected compact chunked prompt under 5000 chars, received ${prompt.length}`
    )

    return '## Capital Gains Interaction\n\n- Section 50C can substitute stamp-duty value for consideration in a property transfer. [1]\n- Section 54F can preserve exemption eligibility for reinvestment, subject to its conditions. [2]\n- Section 69B is relevant where the authorities allege understated investment or unexplained excess consideration. [5]'
  }) as typeof aiProvider.generateContent

  const longLegalBlock = (section: string, clause: string) =>
    `Section ${section} analysis. ${clause} `.repeat(80)

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
      'Explain how Sections 48, 50, 50C, 54F, and 69B interact in a property-sale capital gains case, including valuation risk, exemption eligibility, and where disputes usually arise.',
      [
        {
          memoryId: 'memory-1',
          documentName: 'Section 50C in The Income Tax Act, 1961.pdf',
          pageNumber: 1,
          content: longLegalBlock(
            '50C',
            'The stamp duty value may be deemed to be the full value of consideration when the declared consideration is lower.'
          ),
          contentPreview: 'Section 50C deeming provision for stamp duty valuation.',
          score: 0.99,
          sourceType: SourceType.INTEGRATION,
          title: 'Section 50C',
        },
        {
          memoryId: 'memory-2',
          documentName: 'Section 54F in The Income Tax Act, 1961.pdf',
          pageNumber: 1,
          content: longLegalBlock(
            '54F',
            'Exemption can apply where net consideration is invested in a residential house subject to statutory conditions.'
          ),
          contentPreview: 'Section 54F residential reinvestment exemption.',
          score: 0.98,
          sourceType: SourceType.INTEGRATION,
          title: 'Section 54F',
        },
        {
          memoryId: 'memory-3',
          documentName: 'Section 50 in The Income Tax Act, 1961.pdf',
          pageNumber: 1,
          content: longLegalBlock(
            '50',
            'Depreciable assets are subject to a special computation regime for capital gains.'
          ),
          contentPreview: 'Section 50 special rule for depreciable assets.',
          score: 0.97,
          sourceType: SourceType.INTEGRATION,
          title: 'Section 50',
        },
        {
          memoryId: 'memory-4',
          documentName: 'Section 48 in The Income Tax Act, 1961.pdf',
          pageNumber: 1,
          content: longLegalBlock(
            '48',
            'Capital gains are computed after deduction of transfer expenditure and indexed cost where applicable.'
          ),
          contentPreview: 'Section 48 computation provision.',
          score: 0.96,
          sourceType: SourceType.INTEGRATION,
          title: 'Section 48',
        },
        {
          memoryId: 'memory-5',
          documentName: 'Section 69B in The Income Tax Act, 1961.pdf',
          pageNumber: 1,
          content: longLegalBlock(
            '69B',
            'Where the assessing authority finds the actual investment exceeds the recorded amount, the unexplained excess may be deemed income.'
          ),
          contentPreview: 'Section 69B unexplained investment.',
          score: 0.95,
          sourceType: SourceType.INTEGRATION,
          title: 'Section 69B',
        },
      ]
    )

    assert.equal(calls.length, 1)
    assert.ok(
      (calls[0]?.prompt.length || 0) < 5000,
      `expected compact chunked prompt under 5000 chars, received ${calls[0]?.prompt.length}`
    )
    assert.equal(
      answerResult.answer,
      '## Capital Gains Interaction\n\n- Section 50C can substitute stamp-duty value for consideration in a property transfer. [1]\n- Section 54F can preserve exemption eligibility for reinvestment, subject to its conditions. [2]\n- Section 69B is relevant where the authorities allege understated investment or unexplained excess consideration. [5]'
    )
    assert.deepEqual(
      answerResult.citations.map(citation => citation.index),
      [1, 2, 5]
    )
    assert.match(
      answerResult.citations.map(citation => citation.documentName).join('\n'),
      /Section 50C/i
    )
    assert.match(
      answerResult.citations.map(citation => citation.documentName).join('\n'),
      /Section 69B/i
    )
  } finally {
    aiProvider.generateContent = originalGenerateContent
  }
})
