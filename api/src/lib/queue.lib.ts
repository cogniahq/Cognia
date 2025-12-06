import { Queue, QueueEvents, JobsOptions, QueueOptions } from 'bullmq'
import crypto from 'crypto'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import {
  normalizeText,
  hashCanonical,
  normalizeUrl,
  calculateSimilarity,
} from '../utils/text/text.util'
import { getRedisClient } from './redis.lib'

export interface ContentJobData {
  user_id: string
  raw_text: string
  api_key_id?: string
  metadata?: {
    url?: string
    timestamp?: number
    tags?: string[]
    memory_id?: string
    source?: string
    title?: string
    content_type?: string
    content_summary?: string
  }
}

const queueName = 'process-content'

const queueOptions: QueueOptions = {
  connection: getRedisConnection(true),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 1,
    backoff: { type: 'exponential', delay: 5000 },
    // Note: Job timeout is handled at the AI call level (4 minutes per call)
    // Since AI calls run in parallel, total job time should be ~4 minutes max
    // BullMQ will handle job timeouts through the worker's lockDuration setting
    // Completed jobs are automatically removed to save Redis memory
    // Failed jobs are kept for debugging and user inspection
  },
}

export const contentQueue = new Queue<ContentJobData>(queueName, queueOptions)
export const contentQueueEvents = new QueueEvents(queueName, {
  connection: getRedisConnection(true),
})

const cancelledJobKeyPrefix = 'queue:process-content:cancelled:'

export const getContentJobCancellationKey = (jobId: string) => `${cancelledJobKeyPrefix}${jobId}`

contentQueueEvents.on('waiting', () => {})
contentQueueEvents.on('active', () => {})
contentQueueEvents.on('completed', () => {})

contentQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  const reason = failedReason || 'Unknown error'
  const isCancelled = reason.includes('cancelled') || reason.includes('Job cancelled')

  if (isCancelled) {
    try {
      const job = await contentQueue.getJob(jobId)
      if (job) {
        await job.remove()
      }
    } catch (error) {
      logger.warn(`[Redis Queue] Failed to remove cancelled job`, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  logger.error(`[Redis Queue] Job failed`, {
    jobId,
    state: 'failed',
    failedReason: reason,
  })
})

contentQueueEvents.on('progress', () => {})
contentQueueEvents.on('stalled', async ({ jobId }) => {
  try {
    const job = await contentQueue.getJob(jobId)
    if (job) {
      const redis = getRedisClient()
      const cancellationKey = getContentJobCancellationKey(jobId)
      const cancelled = await redis.get(cancellationKey)
      if (cancelled) {
        await job.remove()
        await redis.del(cancellationKey)
        return
      }
    }
  } catch (error) {
    logger.warn(`[Redis Queue] Error checking stalled job cancellation`, {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  logger.warn(`[Redis Queue] Job stalled`, { jobId })
})
contentQueueEvents.on('delayed', () => {})

export const addContentJob = async (
  data: ContentJobData,
  precomputed?: { canonicalText: string; canonicalHash: string }
) => {
  const canonicalText = precomputed?.canonicalText ?? normalizeText(data.raw_text)
  const canonicalHash = precomputed?.canonicalHash ?? hashCanonical(canonicalText)

  const [waiting, active, delayed] = await Promise.all([
    contentQueue.getWaiting(),
    contentQueue.getActive(),
    contentQueue.getDelayed(),
  ])

  const allJobs = [...waiting, ...active, ...delayed]
  const userJobs = allJobs.filter(job => job.data.user_id === data.user_id)

  if (userJobs.length === 0) {
    const jobId = crypto.randomUUID()
    const jobOptions: JobsOptions = {
      jobId,
    }
    const job = await contentQueue.add(queueName, data, jobOptions)
    return { id: job.id }
  }

  const normalizedUrl =
    data.metadata?.url && data.metadata.url !== 'unknown' ? normalizeUrl(data.metadata.url) : null

  for (const existingJob of userJobs) {
    const existingCanonicalText = normalizeText(existingJob.data.raw_text)
    const existingCanonicalHash = hashCanonical(existingCanonicalText)

    if (existingCanonicalHash === canonicalHash) {
      return { id: existingJob.id, isDuplicate: true }
    }

    if (
      normalizedUrl &&
      existingJob.data.metadata?.url &&
      existingJob.data.metadata.url !== 'unknown'
    ) {
      const existingNormalizedUrl = normalizeUrl(existingJob.data.metadata.url)

      if (normalizedUrl === existingNormalizedUrl) {
        const similarity = calculateSimilarity(canonicalText, existingCanonicalText)

        if (similarity > 0.9) {
          return { id: existingJob.id, isDuplicate: true }
        }
      }
    }
  }

  const jobId = crypto.randomUUID()
  const jobOptions: JobsOptions = {
    jobId,
  }
  const job = await contentQueue.add(queueName, data, jobOptions)

  return { id: job.id }
}

export const cleanQueue = async (): Promise<{
  waiting: number
  active: number
  delayed: number
  completed: number
  failed: number
  total: number
  removed: number
  remaining: number
}> => {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    contentQueue.getWaiting(),
    contentQueue.getActive(),
    contentQueue.getDelayed(),
    contentQueue.getCompleted(),
    contentQueue.getFailed(),
  ])

  const waitingCount = waiting.length
  const activeCount = active.length
  const delayedCount = delayed.length
  const completedCount = completed.length
  const failedCount = failed.length

  const totalJobs = waitingCount + activeCount + delayedCount + completedCount + failedCount

  let removedCount = 0

  // Remove all jobs from all states
  const allJobs = [...waiting, ...active, ...delayed, ...completed, ...failed]
  for (const job of allJobs) {
    try {
      await job.remove()
      removedCount++
    } catch (error) {
      logger.warn(`Failed to remove job ${job.id}`, {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Use obliterate to clean all BullMQ internal keys (stalled-check, meta, events, etc.)
  try {
    await contentQueue.obliterate({ force: true })
    logger.log('Queue obliterated - all internal keys cleaned')
  } catch (error) {
    logger.warn('Failed to obliterate queue', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const [waitingAfter, activeAfter, delayedAfter, completedAfter, failedAfter] = await Promise.all([
    contentQueue.getWaiting(),
    contentQueue.getActive(),
    contentQueue.getDelayed(),
    contentQueue.getCompleted(),
    contentQueue.getFailed(),
  ])

  const totalAfter =
    waitingAfter.length +
    activeAfter.length +
    delayedAfter.length +
    completedAfter.length +
    failedAfter.length

  logger.log('Queue cleaned - removed all jobs and internal keys', {
    before: {
      waiting: waitingCount,
      active: activeCount,
      delayed: delayedCount,
      completed: completedCount,
      failed: failedCount,
      total: totalJobs,
    },
    after: {
      waiting: waitingAfter.length,
      active: activeAfter.length,
      delayed: delayedAfter.length,
      completed: completedAfter.length,
      failed: failedAfter.length,
      total: totalAfter,
    },
    removed: removedCount,
  })

  return {
    waiting: waitingCount,
    active: activeCount,
    delayed: delayedCount,
    completed: completedCount,
    failed: failedCount,
    total: totalJobs,
    removed: removedCount,
    remaining: totalAfter,
  }
}

// Quiet queue event handlers to avoid noisy logs in production. Attach your own
// listeners elsewhere if you need telemetry.
