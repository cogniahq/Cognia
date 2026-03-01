import { Worker } from 'bullmq'
import { INTEGRATION_QUEUES } from '@cogniahq/integrations'
import type { MeetingProcessingJobData } from '@cogniahq/integrations'
import { meetingProcessingService } from '../services/meeting/meeting-processing.service'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'

/**
 * BullMQ worker that picks up meeting-processing jobs and runs the AI pipeline.
 */
export const startMeetingWorker = () => {
  return new Worker<MeetingProcessingJobData>(
    INTEGRATION_QUEUES.MEETING_PROCESSING,
    async job => {
      const { meetingId } = job.data

      logger.log(`[MeetingWorker] Processing meeting ${meetingId}`, { jobId: job.id })

      try {
        await meetingProcessingService.processMeeting(meetingId)

        logger.log(`[MeetingWorker] Completed meeting ${meetingId}`, { jobId: job.id })

        return { success: true, meetingId }
      } catch (err) {
        logger.error(`[MeetingWorker] Failed to process meeting ${meetingId}:`, err)
        throw err
      }
    },
    {
      connection: getRedisConnection(true),
      concurrency: 2,
      lockDuration: 300000, // 5 minutes — AI processing can take a while
      lockRenewTime: 30000,
    }
  )
}
