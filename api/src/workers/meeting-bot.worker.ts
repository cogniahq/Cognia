import { Worker } from 'bullmq'
import { INTEGRATION_QUEUES, MeetingBotClient } from '@cogniahq/integrations'
import type { MeetingBotJobData, MeetingProcessingJobData } from '@cogniahq/integrations'
import { prisma } from '../lib/prisma.lib'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import { integrationService } from '../services/integration'

const BOT_SERVICE_URL = process.env.MEETING_BOT_SERVICE_URL || 'http://localhost:3100'
const POLL_INTERVAL_MS = 10_000 // 10 seconds
const MAX_MEETING_DURATION_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * BullMQ worker that:
 * 1. Picks up MEETING_BOT jobs
 * 2. Calls the bot service to join the meeting
 * 3. Polls the bot service until the meeting ends
 * 4. Saves raw_transcript to the DB
 * 5. Enqueues a MEETING_PROCESSING job
 */
export const startMeetingBotWorker = () => {
  const botClient = new MeetingBotClient(BOT_SERVICE_URL)

  return new Worker<MeetingBotJobData>(
    INTEGRATION_QUEUES.MEETING_BOT,
    async job => {
      const { meetingId, meetingUrl, platform, userId, organizationId, botName } = job.data

      logger.log(`[MeetingBotWorker] Starting bot for meeting ${meetingId}`, { jobId: job.id })

      // Step 1: Tell the bot service to join the meeting
      let session
      try {
        session = await botClient.startSession({
          meetingUrl,
          platform,
          botName,
        })
      } catch (err) {
        logger.error(`[MeetingBotWorker] Failed to start bot session for ${meetingId}:`, err)
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'FAILED' },
        })
        throw err
      }

      // Step 2: Save bot session ID to the meeting record
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          bot_session_id: session.id,
          status: 'IN_MEETING',
        },
      })

      // Step 3: Poll the bot service until the meeting ends or is stopped
      const startTime = Date.now()

      while (Date.now() - startTime < MAX_MEETING_DURATION_MS) {
        await sleep(POLL_INTERVAL_MS)

        // Check if the meeting was manually stopped via the API
        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
          select: { status: true },
        })

        if (!meeting || meeting.status === 'PROCESSING' || meeting.status === 'FAILED') {
          // User stopped the meeting or it was cancelled — tell bot to leave
          try {
            await botClient.stopSession(session.id)
          } catch {
            // Bot may have already left
          }
          break
        }

        // Check bot session status
        let currentSession
        try {
          currentSession = await botClient.getSession(session.id)
        } catch {
          // Bot service may be unavailable — retry
          logger.warn(`[MeetingBotWorker] Failed to poll session ${session.id}, retrying...`)
          continue
        }

        if (currentSession.status === 'ended' || currentSession.status === 'error') {
          break
        }
      }

      // Step 4: Fetch final session with complete transcript
      let finalSession
      try {
        finalSession = await botClient.getSession(session.id)
      } catch (err) {
        logger.error(`[MeetingBotWorker] Failed to fetch final session ${session.id}:`, err)
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'FAILED' },
        })
        throw err
      }

      // Step 5: Save raw transcript to the database
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          raw_transcript: finalSession.transcript as any,
          status: 'PROCESSING',
          ended_at: finalSession.endedAt ? new Date(finalSession.endedAt) : new Date(),
        },
      })

      logger.log(
        `[MeetingBotWorker] Meeting ${meetingId} ended, saved ${finalSession.transcript?.length ?? 0} transcript segments`
      )

      // Step 6: Enqueue the processing job
      const queueManager = integrationService.getQueueManager()
      if (queueManager) {
        const processingData: MeetingProcessingJobData = {
          meetingId,
          botSessionId: session.id,
          userId,
          organizationId,
        }
        await queueManager.addMeetingProcessingJob(processingData)
        logger.log(`[MeetingBotWorker] Enqueued processing job for meeting ${meetingId}`)
      } else {
        logger.error(
          `[MeetingBotWorker] Queue manager not available, cannot enqueue processing for ${meetingId}`
        )
      }

      return { success: true, meetingId, segments: finalSession.transcript.length }
    },
    {
      connection: getRedisConnection(true),
      concurrency: 5,
      lockDuration: MAX_MEETING_DURATION_MS + 60_000, // 4 hours + buffer
      lockRenewTime: 60_000, // Renew lock every minute
    }
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
