import { Worker } from 'bullmq'
import { ContentJobData, getContentJobCancellationKey } from '../lib/queue.lib'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { profileUpdateService } from '../services/profile/profile-update.service'
import { prisma } from '../lib/prisma.lib'
import {
  getQueueConcurrency,
  getRedisConnection,
  getQueueLimiter,
  getQueueStalledInterval,
  getQueueMaxStalledCount,
} from '../utils/core/env.util'
import { memoryIngestionService } from '../services/memory/memory-ingestion.service'
import { memoryScoringService } from '../services/memory/memory-scoring.service'
import { logger } from '../utils/core/logger.util'
import { backgroundGenerationPriorityService } from '../services/core/background-generation-priority.service'
import { getRedisClient } from '../lib/redis.lib'
import { isOpenAISearchOnlyModeEnabled } from '../services/ai/ai-config'

type PrismaError = {
  code?: string
  message?: string
  status?: number
}

const PROFILE_IMPORTANCE_THRESHOLD = Number(process.env.PROFILE_IMPORTANCE_THRESHOLD || 0.7)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getStringMetadataValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const shouldSkipProfileUpdate = (metadata: ContentJobData['metadata']) =>
  isOpenAISearchOnlyModeEnabled() ||
  metadata?.skip_profile_update === true ||
  metadata?.source_type === 'INTEGRATION'

const isSearchPriorityLeaseActive = async (): Promise<boolean> => {
  try {
    return await backgroundGenerationPriorityService.shouldDeferBackgroundGeneration()
  } catch (error) {
    logger.warn('[Redis Worker] search-priority lease check failed, continuing', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

const getSyncedResourceLookup = (metadata: ContentJobData['metadata']) => {
  const syncedResourceId = getStringMetadataValue(metadata?.synced_resource_id)
  if (syncedResourceId) {
    return { type: 'id' as const, syncedResourceId }
  }

  const integrationId = getStringMetadataValue(metadata?.integration_id)
  const integrationType = metadata?.integration_type
  const externalId = getStringMetadataValue(metadata?.external_id)

  if (integrationId && integrationType && externalId) {
    return {
      type: 'composite' as const,
      integrationId,
      integrationType,
      externalId,
    }
  }

  return null
}

const linkSyncedResourceToMemory = async (
  memoryId: string,
  metadata: ContentJobData['metadata']
) => {
  const lookup = getSyncedResourceLookup(metadata)
  if (!lookup) {
    return false
  }

  const maxAttempts = lookup.type === 'id' ? 1 : 5
  const retryDelayMs = 100

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (lookup.type === 'id') {
        await prisma.syncedResource.update({
          where: { id: lookup.syncedResourceId },
          data: { memory_id: memoryId },
        })
      } else {
        await prisma.syncedResource.update({
          where: {
            integration_id_integration_type_external_id: {
              integration_id: lookup.integrationId,
              integration_type: lookup.integrationType,
              external_id: lookup.externalId,
            },
          },
          data: { memory_id: memoryId },
        })
      }

      return true
    } catch (error) {
      const lastAttempt = attempt === maxAttempts
      if (lastAttempt) {
        logger.warn(`[Redis Worker] Failed to link synced resource to memory`, {
          memoryId,
          lookupType: lookup.type,
          error: error instanceof Error ? error.message : String(error),
        })
        return false
      }

      await sleep(retryDelayMs * attempt)
    }
  }

  return false
}

export const startContentWorker = () => {
  return new Worker<ContentJobData>(
    'process-content',
    async job => {
      const redis = getRedisClient()
      const cancellationKey = job.id ? getContentJobCancellationKey(job.id) : null

      const ensureNotCancelled = async () => {
        if (!cancellationKey) {
          return
        }
        const cancelled = await redis.get(cancellationKey)
        if (!cancelled) {
          return
        }
        await redis.del(cancellationKey)
        const cancellationError = new Error('Job cancelled by user request')
        cancellationError.name = 'JobCancelledError'
        throw cancellationError
      }

      await ensureNotCancelled()

      const { user_id, raw_text, metadata } = job.data as ContentJobData
      const baseUrl =
        typeof metadata?.url === 'string' && metadata.url.trim() !== ''
          ? (metadata.url as string).trim()
          : undefined
      const memoryTitle =
        typeof metadata?.title === 'string' && metadata.title.trim() !== ''
          ? (metadata.title as string).trim()
          : undefined
      const skipProfileUpdate = shouldSkipProfileUpdate(metadata)
      let processedMemoryId: string | null = metadata?.memory_id ?? null
      let canonicalData =
        !metadata?.memory_id && raw_text
          ? memoryIngestionService.canonicalizeContent(raw_text, baseUrl)
          : null

      const handleCancellationError = (error?: Error) => {
        if (error && error.name === 'JobCancelledError') {
          logger.warn(`[Redis Worker] Job cancelled by user`, {
            jobId: job.id,
            userId: user_id,
          })
        }
      }

      try {
        if (!metadata?.memory_id) {
          const [user, duplicateCheck] = await Promise.all([
            prisma.user.findUnique({
              where: { id: user_id },
            }),
            canonicalData
              ? memoryIngestionService.findDuplicateMemory({
                  userId: user_id,
                  canonicalHash: canonicalData.canonicalHash,
                  canonicalText: canonicalData.canonicalText,
                  url: baseUrl,
                  title: memoryTitle,
                  source: (metadata?.source as string | undefined) || undefined,
                })
              : Promise.resolve(null),
          ])

          if (duplicateCheck) {
            const merged = await memoryIngestionService.mergeDuplicateMemory(
              duplicateCheck.memory,
              metadata,
              {
                title: memoryTitle,
                url: baseUrl,
                source: (metadata?.source as string | undefined) || undefined,
                content: raw_text,
              }
            )
            logger.log(`[Redis Worker] Duplicate detected, skipping processing`, {
              jobId: job.id,
              userId: user_id,
              existingMemoryId: merged.id,
              reason: duplicateCheck.reason,
            })
            await linkSyncedResourceToMemory(merged.id, metadata)
            const preview =
              (merged.content || '').substring(0, 100) ||
              (metadata?.title as string | undefined) ||
              'Duplicate memory'
            return {
              success: true,
              contentId: merged.id,
              memoryId: merged.id,
              preview,
            }
          }

          if (!user) {
            throw new Error(`User not found: ${user_id}`)
          }
        }

        if (metadata?.memory_id) {
          const pageMetadata = memoryIngestionService.buildPageMetadata(metadata, {
            title: memoryTitle,
            url: baseUrl,
            source: (metadata?.source as string | undefined) || undefined,
            content: raw_text,
          })
          const [existingMemory] = await Promise.all([
            prisma.memory.findUnique({
              where: { id: metadata.memory_id },
              select: { page_metadata: true },
            }),
            ensureNotCancelled(),
          ])
          const mergedMetadata = memoryScoringService.mergeMetadata(
            existingMemory?.page_metadata,
            pageMetadata
          )

          await prisma.memory.update({
            where: { id: metadata.memory_id },
            data: {
              page_metadata: mergedMetadata,
            },
          })

          processedMemoryId = metadata.memory_id
          await linkSyncedResourceToMemory(metadata.memory_id, metadata)

          await prisma.memorySnapshot.create({
            data: {
              user_id,
              raw_text,
            },
          })

          // Generate embeddings and relations in background (non-blocking)
          setImmediate(async () => {
            try {
              await memoryMeshService.generateEmbeddingsForMemory(metadata.memory_id)
              await memoryMeshService.createMemoryRelations(metadata.memory_id, user_id)
            } catch (embeddingError) {
              logger.error(`[Redis Worker] Error generating embeddings:`, embeddingError)
            }
          })

          setImmediate(async () => {
            try {
              if (skipProfileUpdate) {
                return
              }
              if (await isSearchPriorityLeaseActive()) {
                logger.log('[Redis Worker] profile update deferred for search priority lease', {
                  jobId: job.id,
                  userId: user_id,
                })
                return
              }
              const shouldUpdate = await profileUpdateService.shouldUpdateProfile(user_id, 7)
              if (shouldUpdate) {
                await profileUpdateService.updateUserProfile(user_id)
              }
            } catch (profileError) {
              logger.error(`[Redis Worker] Error updating profile:`, profileError)
            }
          })
        } else {
          if (!canonicalData) {
            canonicalData = memoryIngestionService.canonicalizeContent(raw_text, baseUrl)
          }
          const memoryCreateInput = await memoryIngestionService.buildMemoryCreatePayload({
            userId: user_id,
            title: memoryTitle,
            url: baseUrl,
            source: (metadata?.source as string | undefined) || undefined,
            content: raw_text,
            contentPreview: raw_text.slice(0, 400),
            metadata,
            canonicalText: canonicalData.canonicalText,
            canonicalHash: canonicalData.canonicalHash,
          })

          let memory
          try {
            const [createdMemory] = await Promise.all([
              prisma.memory.create({
                data: memoryCreateInput,
              }),
              prisma.memorySnapshot.create({
                data: {
                  user_id,
                  raw_text,
                },
              }),
              ensureNotCancelled(),
            ])
            memory = createdMemory
          } catch (createError) {
            const error = createError as PrismaError
            if (error.code === 'P2002') {
              const existingByCanonical = await prisma.memory.findFirst({
                where: { user_id, canonical_hash: canonicalData?.canonicalHash },
              })

              if (existingByCanonical) {
                await linkSyncedResourceToMemory(existingByCanonical.id, metadata)
                const preview =
                  (existingByCanonical.content || '').substring(0, 100) ||
                  (metadata?.title as string | undefined) ||
                  'Duplicate memory'
                return {
                  success: true,
                  contentId: existingByCanonical.id,
                  memoryId: existingByCanonical.id,
                  preview,
                }
              }
            }
            throw createError
          }

          processedMemoryId = memory.id

          // Generate embeddings and relations in background (non-blocking)
          setImmediate(async () => {
            try {
              await memoryMeshService.generateEmbeddingsForMemory(memory.id)
              await memoryMeshService.createMemoryRelations(memory.id, user_id)
            } catch (embeddingError) {
              logger.error(`[Redis Worker] Error generating embeddings:`, embeddingError)
            }
          })

          await linkSyncedResourceToMemory(memory.id, metadata)

          logger.log(`[Redis Worker] New memory created successfully`, {
            jobId: job.id,
            userId: user_id,
            memoryId: memory.id,
          })

          setImmediate(async () => {
            try {
              if (skipProfileUpdate) {
                return
              }
              if (await isSearchPriorityLeaseActive()) {
                logger.log('[Redis Worker] profile update deferred for search priority lease', {
                  jobId: job.id,
                  userId: user_id,
                })
                return
              }
              const importanceScore = memory.importance_score || 0
              if (importanceScore >= PROFILE_IMPORTANCE_THRESHOLD) {
                const shouldUpdate = await profileUpdateService.shouldUpdateProfile(user_id, 3)
                if (shouldUpdate) {
                  logger.log(`[Redis Worker] Triggering profile update`, {
                    jobId: job.id,
                    userId: user_id,
                  })
                  await profileUpdateService.updateUserProfile(user_id)
                  logger.log(`[Redis Worker] Profile update completed`, {
                    jobId: job.id,
                    userId: user_id,
                  })
                }
              }
            } catch (profileError) {
              logger.error(`[Redis Worker] Error updating profile:`, profileError)
            }
          })
        }

        const result = {
          success: true,
          contentId: processedMemoryId || 'memory_processed',
          memoryId: processedMemoryId,
          preview: raw_text.substring(0, 100) + '...',
        }

        return result
      } catch (err) {
        handleCancellationError(err as Error | undefined)
        throw err
      }
    },
    {
      connection: getRedisConnection(true),
      concurrency: getQueueConcurrency(),
      limiter: getQueueLimiter(),
      stalledInterval: getQueueStalledInterval(),
      maxStalledCount: getQueueMaxStalledCount(),
      lockDuration: 600000, // 10 minutes - jobs can take 2+ minutes to complete
      lockRenewTime: 20000, // Renew lock every 20 seconds (more frequent to prevent timeouts)
    }
  )
}
