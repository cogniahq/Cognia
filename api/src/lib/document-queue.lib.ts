import { Queue, QueueEvents, QueueOptions } from 'bullmq'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import type { DocumentProcessingJob } from '../types/organization.types'

const queueName = 'process-document'

const queueOptions: QueueOptions = {
  connection: getRedisConnection(true),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  },
}

export const documentQueue = new Queue<DocumentProcessingJob>(queueName, queueOptions)
export const documentQueueEvents = new QueueEvents(queueName, {
  connection: getRedisConnection(true),
})

documentQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  logger.error(`[Document Queue] Job failed`, {
    jobId,
    state: 'failed',
    failedReason: failedReason || 'Unknown error',
  })
})

documentQueueEvents.on('completed', async ({ jobId }) => {
  logger.log(`[Document Queue] Job completed`, { jobId })
})

documentQueueEvents.on('stalled', async ({ jobId }) => {
  logger.warn(`[Document Queue] Job stalled`, { jobId })
})

export const addDocumentJob = async (data: DocumentProcessingJob) => {
  const job = await documentQueue.add(queueName, data)
  logger.log(`[Document Queue] Job added`, {
    jobId: job.id,
    documentId: data.documentId,
    filename: data.filename,
  })
  return { id: job.id }
}
