/* eslint-disable @typescript-eslint/no-require-imports */
import test from 'node:test'
import assert from 'node:assert/strict'
import type { ResourceContent } from '@cogniahq/integrations'
import { PluginRegistry } from '@cogniahq/integrations'
import type { UserIntegration } from '@prisma/client'

import { integrationService } from './integration.service'
import { prisma } from '../../lib/prisma.lib'
import { memoryIngestionService } from '../memory/memory-ingestion.service'
type QueueLibHandle = {
  addContentJob: typeof import('../../lib/queue.lib').addContentJob
  contentQueue: {
    close(): Promise<void>
  }
  contentQueueEvents: {
    close(): Promise<void>
  }
}

const queueLib = require('../../lib/queue.lib') as QueueLibHandle

function createResourceContent(overrides: Partial<ResourceContent> = {}): ResourceContent {
  return {
    id: 'resource-1',
    externalId: 'drive-file-1',
    type: 'file',
    title: 'Quarterly Security Review.pdf',
    content: 'Quarterly security review findings',
    contentHash: 'content-hash-1',
    mimeType: 'application/pdf',
    url: 'https://drive.google.com/file/d/drive-file-1/view',
    metadata: {},
    author: {
      id: 'alice-example',
      name: 'Alice Example',
      email: 'alice@example.com',
    },
    createdAt: new Date('2026-04-05T14:00:00.000Z'),
    updatedAt: new Date('2026-04-05T14:00:00.000Z'),
    ...overrides,
  }
}

test('integration queue jobs preserve sync linkage and skip inline profile updates', async () => {
  const originalAddContentJob = queueLib.addContentJob
  const originalCanonicalizeContent = memoryIngestionService.canonicalizeContent
  const originalFindDuplicateMemory = memoryIngestionService.findDuplicateMemory

  let queuedJob: Parameters<typeof queueLib.addContentJob>[0] | null = null

  queueLib.addContentJob = (async data => {
    queuedJob = data
    return { id: 'job-1' }
  }) as typeof queueLib.addContentJob

  memoryIngestionService.canonicalizeContent = ((content: string) => ({
    canonicalText: content,
    canonicalHash: 'canonical-hash-1',
  })) as typeof memoryIngestionService.canonicalizeContent

  memoryIngestionService.findDuplicateMemory = (async () =>
    null) as typeof memoryIngestionService.findDuplicateMemory

  try {
    await (
      integrationService as unknown as {
        createMemoryFromContent: (
          content: ResourceContent,
          context: {
            userId: string
            organizationId?: string | null
            integrationId: string
            integrationType: 'user' | 'organization'
            provider: string
            syncedResourceId: string
          }
        ) => Promise<void>
      }
    ).createMemoryFromContent(createResourceContent(), {
      userId: 'user-1',
      organizationId: 'org-1',
      integrationId: 'integration-1',
      integrationType: 'user',
      provider: 'google_drive',
      syncedResourceId: 'sync-1',
    })

    assert.ok(queuedJob)
    assert.equal(queuedJob?.user_id, 'user-1')
    assert.equal(queuedJob?.raw_text, 'Quarterly security review findings')
    assert.equal(queuedJob?.metadata?.source, 'google_drive')
    assert.equal(queuedJob?.metadata?.source_type, 'INTEGRATION')
    assert.equal(queuedJob?.metadata?.organization_id, 'org-1')
    assert.equal(queuedJob?.metadata?.integration_id, 'integration-1')
    assert.equal(queuedJob?.metadata?.integration_type, 'user')
    assert.equal(queuedJob?.metadata?.external_id, 'drive-file-1')
    assert.equal(queuedJob?.metadata?.synced_resource_id, 'sync-1')
    assert.equal(queuedJob?.metadata?.skip_profile_update, true)
    assert.deepEqual(queuedJob?.metadata?.page_metadata, {
      integration_provider: 'google_drive',
      external_id: 'drive-file-1',
      mime_type: 'application/pdf',
      author: {
        id: 'alice-example',
        name: 'Alice Example',
        email: 'alice@example.com',
      },
    })
  } finally {
    queueLib.addContentJob = originalAddContentJob
    memoryIngestionService.canonicalizeContent = originalCanonicalizeContent
    memoryIngestionService.findDuplicateMemory = originalFindDuplicateMemory
    await Promise.allSettled([
      queueLib.contentQueue.close(),
      queueLib.contentQueueEvents.close(),
      prisma.$disconnect(),
    ])
  }
})

test('integration resync repairs unchanged resources when they are not linked yet', async () => {
  const shouldSkipUnchangedResource = (
    integrationService as unknown as {
      shouldSkipUnchangedResource: (
        existingSynced: { last_synced_at: Date; memory_id: string | null } | null,
        modifiedAt: Date
      ) => boolean
    }
  ).shouldSkipUnchangedResource

  assert.equal(
    shouldSkipUnchangedResource(
      {
        last_synced_at: new Date('2026-04-05T14:00:00.000Z'),
        memory_id: null,
      },
      new Date('2026-04-05T13:59:00.000Z')
    ),
    false
  )

  assert.equal(
    shouldSkipUnchangedResource(
      {
        last_synced_at: new Date('2026-04-05T14:00:00.000Z'),
        memory_id: 'memory-1',
      },
      new Date('2026-04-05T13:59:00.000Z')
    ),
    true
  )
})

test('direct integration sync paginates through all Google Drive resource pages', async () => {
  const originalGet = PluginRegistry.get
  const originalFindFirst = prisma.organizationMember.findFirst
  const originalFindUnique = prisma.syncedResource.findUnique
  const originalUpsert = prisma.syncedResource.upsert
  const originalUserIntegrationUpdate = prisma.userIntegration.update

  const integrationServiceHandle = integrationService as unknown as {
    performDirectSync: (
      integration: UserIntegration,
      integrationType: 'user' | 'organization'
    ) => Promise<void>
    getDecryptedTokens: (integration: UserIntegration) => {
      accessToken: string
      refreshToken?: string
      expiresAt?: Date
    }
    createMemoryFromContent: (
      content: ResourceContent,
      context: {
        userId: string
        organizationId?: string | null
        integrationId: string
        integrationType: 'user' | 'organization'
        provider: string
        syncedResourceId: string
      }
    ) => Promise<void>
  }

  const originalGetDecryptedTokens = integrationServiceHandle.getDecryptedTokens
  const originalCreateMemoryFromContent = integrationServiceHandle.createMemoryFromContent

  const listCalls: Array<{ cursor?: string; limit?: number }> = []
  const fetchedExternalIds: string[] = []
  const createdMemoryIds: string[] = []
  let upsertCount = 0

  const firstPageResource = {
    id: 'resource-1',
    externalId: 'drive-file-1',
    type: 'file',
    name: 'Page 1 doc',
    mimeType: 'application/vnd.google-apps.document',
    modifiedAt: new Date('2026-04-08T05:00:00.000Z'),
  }
  const secondPageResource = {
    id: 'resource-2',
    externalId: 'drive-file-2',
    type: 'file',
    name: 'Page 2 doc',
    mimeType: 'application/vnd.google-apps.document',
    modifiedAt: new Date('2026-04-08T05:01:00.000Z'),
  }

  const integrationRecord: UserIntegration = {
    id: 'integration-1',
    user_id: 'user-1',
    provider: 'google_drive',
    access_token: 'encrypted-access-token',
    refresh_token: null,
    token_expires_at: null,
    config: null,
    status: 'ACTIVE',
    storage_strategy: 'FULL_CONTENT',
    sync_frequency: 'HOURLY',
    last_sync_at: null,
    last_error: null,
    webhook_id: null,
    connected_at: new Date('2026-04-08T05:00:00.000Z'),
    updated_at: new Date('2026-04-08T05:00:00.000Z'),
  }

  PluginRegistry.get = ((_provider: string) => {
    void _provider

    return {
      listResources: async (_tokens: unknown, options?: { cursor?: string; limit?: number }) => {
        listCalls.push({
          cursor: options?.cursor,
          limit: options?.limit,
        })

        if (!options?.cursor) {
          return {
            resources: [firstPageResource],
            nextCursor: 'page-2',
            hasMore: true,
          }
        }

        assert.equal(options.cursor, 'page-2')
        return {
          resources: [secondPageResource],
          nextCursor: undefined,
          hasMore: false,
        }
      },
      fetchResource: async (_tokens: unknown, externalId: string) => {
        fetchedExternalIds.push(externalId)
        return createResourceContent({
          externalId,
          id: externalId,
          title: `Fetched ${externalId}`,
          mimeType: 'application/vnd.google-apps.document',
          content: `Verbatim content for ${externalId}`,
          contentHash: `content-hash-${externalId}`,
          url: `https://docs.google.com/document/d/${externalId}/edit`,
        })
      },
      capabilities: {
        webhooks: false,
      },
    } as ReturnType<typeof PluginRegistry.get>
  }) as typeof PluginRegistry.get

  prisma.organizationMember.findFirst = (async (): Promise<null> =>
    null) as typeof prisma.organizationMember.findFirst

  prisma.syncedResource.findUnique = (async (): Promise<null> =>
    null) as typeof prisma.syncedResource.findUnique

  prisma.syncedResource.upsert = (async (): Promise<{ id: string }> => {
    upsertCount += 1
    return {
      id: `synced-${upsertCount}`,
    }
  }) as unknown as typeof prisma.syncedResource.upsert

  prisma.userIntegration.update = (async (): Promise<UserIntegration> =>
    integrationRecord) as unknown as typeof prisma.userIntegration.update

  integrationServiceHandle.getDecryptedTokens = (() => ({
    accessToken: 'test-access-token',
  })) as typeof integrationServiceHandle.getDecryptedTokens

  integrationServiceHandle.createMemoryFromContent = (async (
    content: ResourceContent,
    context: { syncedResourceId: string }
  ): Promise<void> => {
    createdMemoryIds.push(`${content.externalId}:${context.syncedResourceId}`)
  }) as typeof integrationServiceHandle.createMemoryFromContent

  try {
    await integrationServiceHandle.performDirectSync(integrationRecord, 'user')

    assert.deepEqual(listCalls, [
      { cursor: undefined, limit: 50 },
      { cursor: 'page-2', limit: 50 },
    ])
    assert.deepEqual(fetchedExternalIds, ['drive-file-1', 'drive-file-2'])
    assert.deepEqual(createdMemoryIds, ['drive-file-1:synced-1', 'drive-file-2:synced-2'])
  } finally {
    PluginRegistry.get = originalGet
    prisma.organizationMember.findFirst = originalFindFirst
    prisma.syncedResource.findUnique = originalFindUnique
    prisma.syncedResource.upsert = originalUpsert
    prisma.userIntegration.update = originalUserIntegrationUpdate
    integrationServiceHandle.getDecryptedTokens = originalGetDecryptedTokens
    integrationServiceHandle.createMemoryFromContent = originalCreateMemoryFromContent
  }
})
