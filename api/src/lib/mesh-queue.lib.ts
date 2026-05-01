import { Queue, QueueEvents, type QueueOptions } from 'bullmq'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'

export interface MeshRecomputeJobData {
  scopeType: 'user' | 'organization'
  scopeId: string
}

export const MESH_QUEUE_NAME = 'mesh-recompute'
export const MESH_REPEATABLE_KEY_PREFIX = 'mesh-recompute-recurring'

const queueOptions: QueueOptions = {
  connection: getRedisConnection(true),
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 60 * 60, count: 200 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  },
}

export const meshQueue = new Queue<MeshRecomputeJobData>(MESH_QUEUE_NAME, queueOptions)
export const meshQueueEvents = new QueueEvents(MESH_QUEUE_NAME, {
  connection: getRedisConnection(true),
})

meshQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('[mesh-queue] job failed', { jobId, failedReason })
})

/**
 * Enqueue a one-shot mesh recompute (e.g. immediately after a large ingest).
 */
export async function enqueueMeshRecompute(data: MeshRecomputeJobData): Promise<string | null> {
  const job = await meshQueue.add(MESH_QUEUE_NAME, data, {
    jobId: `${data.scopeType}:${data.scopeId}:${Date.now()}`,
  })
  return job.id ?? null
}

/**
 * Schedule a recurring nightly recompute for a scope. Idempotent — adding
 * the same scope twice replaces the schedule.
 */
export async function scheduleNightlyMeshRecompute(data: MeshRecomputeJobData): Promise<void> {
  const repeatKey = `${MESH_REPEATABLE_KEY_PREFIX}:${data.scopeType}:${data.scopeId}`

  // Remove any prior schedule with the same key to keep this idempotent.
  const repeatables = await meshQueue.getRepeatableJobs()
  for (const job of repeatables) {
    if (job.id === repeatKey) {
      await meshQueue.removeRepeatableByKey(job.key)
    }
  }

  const cron = process.env.MESH_RECOMPUTE_CRON || '0 3 * * *' // 03:00 UTC default
  await meshQueue.add(MESH_QUEUE_NAME, data, {
    jobId: repeatKey,
    repeat: { pattern: cron, tz: 'UTC' },
  })

  logger.log('[mesh-queue] scheduled nightly recompute', {
    scopeType: data.scopeType,
    scopeId: data.scopeId,
    cron,
  })
}
