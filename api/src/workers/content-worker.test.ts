/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import test from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../lib/prisma.lib'
import { auditLogService } from '../services/core/audit-log.service'
import { backgroundGenerationPriorityService } from '../services/core/background-generation-priority.service'
import { memoryIngestionService } from '../services/memory/memory-ingestion.service'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { profileUpdateService } from '../services/profile/profile-update.service'

type Processor = (job: {
  id?: string
  data: {
    user_id: string
    raw_text: string
    metadata?: Record<string, unknown>
  }
}) => Promise<{
  success: boolean
  contentId: string
  memoryId: string | null
  preview: string
}>

function loadWorkerProcessor(): {
  processor: Processor
  restore: () => void
} {
  const bullmqPath = require.resolve('bullmq')
  const originalBullmqModule = require.cache[bullmqPath]
  const modulePath = require.resolve('./content-worker')
  let processor: Processor | null = null

  class FakeWorker {
    constructor(_queueName: string, jobProcessor: Processor) {
      processor = jobProcessor
    }
  }

  class FakeQueue {
    constructor() {}
  }

  class FakeQueueEvents {
    constructor() {}

    on() {
      return this
    }
  }

  require.cache[bullmqPath] = {
    id: bullmqPath,
    filename: bullmqPath,
    loaded: true,
    exports: {
      Worker: FakeWorker,
      Queue: FakeQueue,
      QueueEvents: FakeQueueEvents,
    },
  } as unknown as NodeModule

  delete require.cache[modulePath]
  const { startContentWorker } = require('./content-worker') as {
    startContentWorker: () => unknown
  }
  startContentWorker()

  if (!processor) {
    throw new Error('Failed to capture content worker processor')
  }

  return {
    processor,
    restore: () => {
      if (originalBullmqModule) {
        require.cache[bullmqPath] = originalBullmqModule
      } else {
        delete require.cache[bullmqPath]
      }
      delete require.cache[modulePath]
    },
  }
}

function loadMemoryProcessingController() {
  const modulePath = require.resolve('../controller/memory/memory-processing.controller')

  delete require.cache[modulePath]
  const { MemoryProcessingController } =
    require('../controller/memory/memory-processing.controller') as {
      MemoryProcessingController: typeof import('../controller/memory/memory-processing.controller').MemoryProcessingController
    }

  return {
    MemoryProcessingController,
    restore: () => {
      delete require.cache[modulePath]
    },
  }
}

test('content worker returns the created memory id, links synced resources, and skips inline profile updates for integration sync jobs', async () => {
  const { processor, restore } = loadWorkerProcessor()

  const originalFindUser = prisma.user.findUnique
  const originalCreateMemory = prisma.memory.create
  const originalCreateSnapshot = prisma.memorySnapshot.create
  const originalUpdateSyncedResource = prisma.syncedResource.update
  const originalCanonicalizeContent = memoryIngestionService.canonicalizeContent
  const originalFindDuplicateMemory = memoryIngestionService.findDuplicateMemory
  const originalBuildMemoryCreatePayload = memoryIngestionService.buildMemoryCreatePayload
  const originalGenerateEmbeddings = memoryMeshService.generateEmbeddingsForMemory
  const originalCreateRelations = memoryMeshService.createMemoryRelations
  const originalShouldUpdateProfile = profileUpdateService.shouldUpdateProfile
  const originalUpdateUserProfile = profileUpdateService.updateUserProfile

  let syncedResourceUpdate: {
    where: { id: string }
    data: { memory_id: string }
  } | null = null
  let profileCheckCalls = 0

  prisma.user.findUnique = (async () => ({
    id: 'user-1',
  })) as unknown as typeof prisma.user.findUnique
  prisma.memory.create = (async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'memory-1',
    importance_score: 0,
    ...data,
  })) as unknown as typeof prisma.memory.create
  prisma.memorySnapshot.create = (async () => ({
    id: 'snapshot-1',
  })) as unknown as typeof prisma.memorySnapshot.create
  prisma.syncedResource.update = (async (args: any): Promise<any> => {
    syncedResourceUpdate = {
      where: { id: args.where.id },
      data: { memory_id: args.data.memory_id as string },
    }
    return {
      id: args.where.id,
      memory_id: args.data.memory_id as string,
    }
  }) as unknown as typeof prisma.syncedResource.update

  memoryIngestionService.canonicalizeContent = ((content: string) => ({
    canonicalText: content,
    canonicalHash: 'canonical-hash-1',
  })) as unknown as typeof memoryIngestionService.canonicalizeContent
  memoryIngestionService.findDuplicateMemory = (async (): Promise<null> =>
    null) as unknown as typeof memoryIngestionService.findDuplicateMemory
  memoryIngestionService.buildMemoryCreatePayload = ((input: {
    userId: string
    title?: string
    url?: string
    source?: string
    content: string
    contentPreview?: string
    metadata?: Record<string, unknown>
    canonicalText: string
    canonicalHash: string
  }) => ({
    user_id: input.userId,
    title: input.title,
    url: input.url,
    source: input.source,
    content: input.content,
    content_preview: input.contentPreview,
    page_metadata: input.metadata?.page_metadata ?? {},
    canonical_text: input.canonicalText,
    canonical_hash: input.canonicalHash,
  })) as unknown as typeof memoryIngestionService.buildMemoryCreatePayload

  memoryMeshService.generateEmbeddingsForMemory = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.generateEmbeddingsForMemory
  memoryMeshService.createMemoryRelations = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.createMemoryRelations
  profileUpdateService.shouldUpdateProfile = (async (): Promise<boolean> => {
    profileCheckCalls++
    return false
  }) as unknown as typeof profileUpdateService.shouldUpdateProfile
  profileUpdateService.updateUserProfile = (async (): Promise<void> =>
    undefined) as unknown as typeof profileUpdateService.updateUserProfile

  try {
    const result = await processor({
      id: 'job-1',
      data: {
        user_id: 'user-1',
        raw_text: 'Quarterly security review findings',
        metadata: {
          title: 'Quarterly Security Review.pdf',
          url: 'https://drive.google.com/file/d/drive-file-1/view',
          source: 'google_drive',
          source_type: 'INTEGRATION',
          synced_resource_id: 'sync-1',
          skip_profile_update: true,
          page_metadata: {
            integration_provider: 'google_drive',
            external_id: 'drive-file-1',
            mime_type: 'application/pdf',
          },
        },
      },
    })

    await new Promise(resolve => setImmediate(resolve))

    assert.equal(result.memoryId, 'memory-1')
    assert.deepEqual(syncedResourceUpdate, {
      where: { id: 'sync-1' },
      data: { memory_id: 'memory-1' },
    })
    assert.equal(profileCheckCalls, 0)
  } finally {
    prisma.user.findUnique = originalFindUser
    prisma.memory.create = originalCreateMemory
    prisma.memorySnapshot.create = originalCreateSnapshot
    prisma.syncedResource.update = originalUpdateSyncedResource
    memoryIngestionService.canonicalizeContent = originalCanonicalizeContent
    memoryIngestionService.findDuplicateMemory = originalFindDuplicateMemory
    memoryIngestionService.buildMemoryCreatePayload = originalBuildMemoryCreatePayload
    memoryMeshService.generateEmbeddingsForMemory = originalGenerateEmbeddings
    memoryMeshService.createMemoryRelations = originalCreateRelations
    profileUpdateService.shouldUpdateProfile = originalShouldUpdateProfile
    profileUpdateService.updateUserProfile = originalUpdateUserProfile
    restore()
  }
})

test('content worker links synced resources on duplicate hits too', async () => {
  const { processor, restore } = loadWorkerProcessor()

  const originalFindUser = prisma.user.findUnique
  const originalMemorySnapshotCreate = prisma.memorySnapshot.create
  const originalUpdateSyncedResource = prisma.syncedResource.update
  const originalCanonicalizeContent = memoryIngestionService.canonicalizeContent
  const originalFindDuplicateMemory = memoryIngestionService.findDuplicateMemory
  const originalMergeDuplicateMemory = memoryIngestionService.mergeDuplicateMemory
  const originalGenerateEmbeddings = memoryMeshService.generateEmbeddingsForMemory
  const originalCreateRelations = memoryMeshService.createMemoryRelations
  const originalShouldUpdateProfile = profileUpdateService.shouldUpdateProfile
  const originalUpdateUserProfile = profileUpdateService.updateUserProfile

  let syncedResourceUpdate: {
    where: { id: string }
    data: { memory_id: string }
  } | null = null
  let profileCheckCalls = 0

  prisma.user.findUnique = (async () => ({
    id: 'user-1',
  })) as unknown as typeof prisma.user.findUnique
  prisma.memorySnapshot.create = (async () => ({
    id: 'snapshot-1',
  })) as unknown as typeof prisma.memorySnapshot.create
  prisma.syncedResource.update = (async (args: any): Promise<any> => {
    syncedResourceUpdate = {
      where: { id: args.where.id },
      data: { memory_id: args.data.memory_id as string },
    }
    return {
      id: args.where.id,
      memory_id: args.data.memory_id as string,
    }
  }) as unknown as typeof prisma.syncedResource.update

  memoryIngestionService.canonicalizeContent = ((content: string) => ({
    canonicalText: content,
    canonicalHash: 'canonical-hash-duplicate',
  })) as unknown as typeof memoryIngestionService.canonicalizeContent
  memoryIngestionService.findDuplicateMemory = (async (): Promise<any> => ({
    reason: 'canonical',
    memory: {
      id: 'memory-duplicate',
      content: 'Existing duplicate memory',
    },
  })) as unknown as typeof memoryIngestionService.findDuplicateMemory
  memoryIngestionService.mergeDuplicateMemory = (async (duplicateMemory: any): Promise<any> => ({
    ...duplicateMemory,
    id: 'memory-duplicate',
    content: 'Existing duplicate memory',
  })) as unknown as typeof memoryIngestionService.mergeDuplicateMemory

  memoryMeshService.generateEmbeddingsForMemory = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.generateEmbeddingsForMemory
  memoryMeshService.createMemoryRelations = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.createMemoryRelations
  profileUpdateService.shouldUpdateProfile = (async (): Promise<boolean> => {
    profileCheckCalls++
    return false
  }) as unknown as typeof profileUpdateService.shouldUpdateProfile
  profileUpdateService.updateUserProfile = (async (): Promise<void> =>
    undefined) as unknown as typeof profileUpdateService.updateUserProfile

  try {
    const result = await processor({
      id: 'job-duplicate',
      data: {
        user_id: 'user-1',
        raw_text: 'Quarterly security review findings',
        metadata: {
          title: 'Quarterly Security Review.pdf',
          url: 'https://drive.google.com/file/d/drive-file-1/view',
          source: 'google_drive',
          source_type: 'INTEGRATION',
          synced_resource_id: 'sync-duplicate',
          skip_profile_update: true,
        },
      },
    })

    await new Promise(resolve => setImmediate(resolve))

    assert.equal(result.memoryId, 'memory-duplicate')
    assert.deepEqual(syncedResourceUpdate, {
      where: { id: 'sync-duplicate' },
      data: { memory_id: 'memory-duplicate' },
    })
    assert.equal(profileCheckCalls, 0)
  } finally {
    prisma.user.findUnique = originalFindUser
    prisma.memorySnapshot.create = originalMemorySnapshotCreate
    prisma.syncedResource.update = originalUpdateSyncedResource
    memoryIngestionService.canonicalizeContent = originalCanonicalizeContent
    memoryIngestionService.findDuplicateMemory = originalFindDuplicateMemory
    memoryIngestionService.mergeDuplicateMemory = originalMergeDuplicateMemory
    memoryMeshService.generateEmbeddingsForMemory = originalGenerateEmbeddings
    memoryMeshService.createMemoryRelations = originalCreateRelations
    profileUpdateService.shouldUpdateProfile = originalShouldUpdateProfile
    profileUpdateService.updateUserProfile = originalUpdateUserProfile
    restore()
    setImmediate(() => process.exit(process.exitCode ?? 0))
  }
})

test('content worker defers inline profile updates while a search-priority lease is active', async () => {
  const { processor, restore } = loadWorkerProcessor()

  const originalFindUser = prisma.user.findUnique
  const originalCreateMemory = prisma.memory.create
  const originalCreateSnapshot = prisma.memorySnapshot.create
  const originalCanonicalizeContent = memoryIngestionService.canonicalizeContent
  const originalFindDuplicateMemory = memoryIngestionService.findDuplicateMemory
  const originalBuildMemoryCreatePayload = memoryIngestionService.buildMemoryCreatePayload
  const originalGenerateEmbeddings = memoryMeshService.generateEmbeddingsForMemory
  const originalCreateRelations = memoryMeshService.createMemoryRelations
  const originalShouldUpdateProfile = profileUpdateService.shouldUpdateProfile
  const originalUpdateUserProfile = profileUpdateService.updateUserProfile
  const originalShouldDeferBackgroundGeneration =
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  let profileCheckCalls = 0
  let profileUpdateCalls = 0

  prisma.user.findUnique = (async () => ({
    id: 'user-1',
  })) as unknown as typeof prisma.user.findUnique
  prisma.memory.create = (async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'memory-search-priority',
    importance_score: 0.95,
    ...data,
  })) as unknown as typeof prisma.memory.create
  prisma.memorySnapshot.create = (async () => ({
    id: 'snapshot-search-priority',
  })) as unknown as typeof prisma.memorySnapshot.create

  memoryIngestionService.canonicalizeContent = ((content: string) => ({
    canonicalText: content,
    canonicalHash: 'canonical-hash-search-priority',
  })) as unknown as typeof memoryIngestionService.canonicalizeContent
  memoryIngestionService.findDuplicateMemory = (async (): Promise<null> =>
    null) as unknown as typeof memoryIngestionService.findDuplicateMemory
  memoryIngestionService.buildMemoryCreatePayload = ((input: {
    userId: string
    title?: string
    url?: string
    source?: string
    content: string
    contentPreview?: string
    metadata?: Record<string, unknown>
    canonicalText: string
    canonicalHash: string
  }) => ({
    user_id: input.userId,
    title: input.title,
    url: input.url,
    source: input.source,
    content: input.content,
    content_preview: input.contentPreview,
    page_metadata: input.metadata?.page_metadata ?? {},
    canonical_text: input.canonicalText,
    canonical_hash: input.canonicalHash,
    importance_score: 0.95,
  })) as unknown as typeof memoryIngestionService.buildMemoryCreatePayload

  memoryMeshService.generateEmbeddingsForMemory = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.generateEmbeddingsForMemory
  memoryMeshService.createMemoryRelations = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.createMemoryRelations
  profileUpdateService.shouldUpdateProfile = (async (): Promise<boolean> => {
    profileCheckCalls++
    return true
  }) as unknown as typeof profileUpdateService.shouldUpdateProfile
  profileUpdateService.updateUserProfile = (async (): Promise<void> => {
    profileUpdateCalls++
    return undefined
  }) as unknown as typeof profileUpdateService.updateUserProfile
  backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
    (async (): Promise<boolean> =>
      true) as typeof backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  try {
    const result = await processor({
      id: 'job-search-priority',
      data: {
        user_id: 'user-1',
        raw_text: 'High-importance product strategy note',
        metadata: {
          title: 'Product Strategy Note',
          url: 'https://example.com/strategy',
          source: 'extension',
          source_type: 'EXTENSION',
        },
      },
    })

    await new Promise(resolve => setImmediate(resolve))

    assert.equal(result.memoryId, 'memory-search-priority')
    assert.equal(profileCheckCalls, 0)
    assert.equal(profileUpdateCalls, 0)
  } finally {
    prisma.user.findUnique = originalFindUser
    prisma.memory.create = originalCreateMemory
    prisma.memorySnapshot.create = originalCreateSnapshot
    memoryIngestionService.canonicalizeContent = originalCanonicalizeContent
    memoryIngestionService.findDuplicateMemory = originalFindDuplicateMemory
    memoryIngestionService.buildMemoryCreatePayload = originalBuildMemoryCreatePayload
    memoryMeshService.generateEmbeddingsForMemory = originalGenerateEmbeddings
    memoryMeshService.createMemoryRelations = originalCreateRelations
    profileUpdateService.shouldUpdateProfile = originalShouldUpdateProfile
    profileUpdateService.updateUserProfile = originalUpdateUserProfile
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
      originalShouldDeferBackgroundGeneration
    restore()
  }
})

test('memory processing controller defers profile updates while a search-priority lease is active', async () => {
  const { MemoryProcessingController, restore } = loadMemoryProcessingController()

  const originalFindDuplicateMemory = memoryIngestionService.findDuplicateMemory
  const originalCanonicalizeContent = memoryIngestionService.canonicalizeContent
  const originalBuildMemoryCreatePayload = memoryIngestionService.buildMemoryCreatePayload
  const originalCreateMemory = prisma.memory.create
  const originalCreateSnapshot = prisma.memorySnapshot.create
  const originalProcessMemoryForMesh = memoryMeshService.processMemoryForMesh
  const originalLogMemoryCapture = auditLogService.logMemoryCapture
  const originalShouldUpdateProfile = profileUpdateService.shouldUpdateProfile
  const originalUpdateUserProfile = profileUpdateService.updateUserProfile
  const originalShouldDeferBackgroundGeneration =
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  let profileCheckCalls = 0
  let profileUpdateCalls = 0

  memoryIngestionService.findDuplicateMemory = (async (): Promise<null> =>
    null) as unknown as typeof memoryIngestionService.findDuplicateMemory
  memoryIngestionService.canonicalizeContent = ((content: string) => ({
    canonicalText: content,
    canonicalHash: 'canonical-hash-controller',
  })) as unknown as typeof memoryIngestionService.canonicalizeContent
  memoryIngestionService.buildMemoryCreatePayload = ((input: {
    userId: string
    title?: string
    url?: string
    source?: string
    content: string
    contentPreview?: string
    metadata?: Record<string, unknown>
    canonicalText: string
    canonicalHash: string
  }) => ({
    user_id: input.userId,
    title: input.title,
    url: input.url,
    source: input.source,
    content: input.content,
    content_preview: input.contentPreview,
    page_metadata: input.metadata?.page_metadata ?? {},
    canonical_text: input.canonicalText,
    canonical_hash: input.canonicalHash,
  })) as unknown as typeof memoryIngestionService.buildMemoryCreatePayload
  prisma.memory.create = (async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'controller-memory-1',
    importance_score: 0.95,
    ...data,
  })) as unknown as typeof prisma.memory.create
  prisma.memorySnapshot.create = (async () => ({
    id: 'controller-snapshot-1',
  })) as unknown as typeof prisma.memorySnapshot.create
  memoryMeshService.processMemoryForMesh = (async (): Promise<void> =>
    undefined) as unknown as typeof memoryMeshService.processMemoryForMesh
  auditLogService.logMemoryCapture = (async (): Promise<void> =>
    undefined) as unknown as typeof auditLogService.logMemoryCapture
  profileUpdateService.shouldUpdateProfile = (async (): Promise<boolean> => {
    profileCheckCalls++
    return true
  }) as unknown as typeof profileUpdateService.shouldUpdateProfile
  profileUpdateService.updateUserProfile = (async (): Promise<void> => {
    profileUpdateCalls++
  }) as unknown as typeof profileUpdateService.updateUserProfile
  backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
    (async (): Promise<boolean> =>
      true) as typeof backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  const req = {
    body: {
      content: 'High-value security report with profile-worthy signals',
      title: 'High Value Security Report.pdf',
      metadata: {
        source: 'google_drive',
      },
    },
    user: { id: 'controller-user' },
    ip: '127.0.0.1',
    get: () => 'unit-test',
  } as any

  const res = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.payload = payload
      return this
    },
    payload: null as unknown,
  } as any

  try {
    await MemoryProcessingController.processRawContent(req, res)
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(res.statusCode, 200)
    assert.equal(profileCheckCalls, 0)
    assert.equal(profileUpdateCalls, 0)
  } finally {
    memoryIngestionService.findDuplicateMemory = originalFindDuplicateMemory
    memoryIngestionService.canonicalizeContent = originalCanonicalizeContent
    memoryIngestionService.buildMemoryCreatePayload = originalBuildMemoryCreatePayload
    prisma.memory.create = originalCreateMemory
    prisma.memorySnapshot.create = originalCreateSnapshot
    memoryMeshService.processMemoryForMesh = originalProcessMemoryForMesh
    auditLogService.logMemoryCapture = originalLogMemoryCapture
    profileUpdateService.shouldUpdateProfile = originalShouldUpdateProfile
    profileUpdateService.updateUserProfile = originalUpdateUserProfile
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
      originalShouldDeferBackgroundGeneration
    restore()
  }
})
