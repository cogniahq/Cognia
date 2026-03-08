import { Worker } from 'bullmq'
import type { Prisma } from '@prisma/client'
import { INTEGRATION_QUEUES, MeetingBotClient } from '@cogniahq/integrations'
import type { MeetingBotJobData, MeetingProcessingJobData } from '@cogniahq/integrations'
import { prisma } from '../lib/prisma.lib'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import { integrationService } from '../services/integration'
import { meetingProcessingService } from '../services/meeting/meeting-processing.service'

const BOT_SERVICE_URL = process.env.MEETING_BOT_SERVICE_URL || 'http://localhost:3100'
const POLL_INTERVAL_MS = 10_000 // 10 seconds
const MAX_MEETING_DURATION_MS = 4 * 60 * 60 * 1000 // 4 hours
const FINAL_SESSION_RETRY_ATTEMPTS = 6

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

      // Step 2: Save bot session ID to the meeting record if the meeting
      // has not already been stopped while the bot was joining.
      const joinUpdate = await prisma.meeting.updateMany({
        where: {
          id: meetingId,
          status: 'JOINING',
        },
        data: {
          bot_session_id: session.id,
          status: 'IN_MEETING',
        },
      })

      let stopRequested = joinUpdate.count === 0
      let stopCommandIssued = false

      if (stopRequested) {
        logger.warn(
          `[MeetingBotWorker] Meeting ${meetingId} was stopped before the bot finished joining; ending session ${session.id}`
        )
      }

      // Step 3: Poll the bot service until the meeting ends or is stopped
      const startTime = Date.now()

      while (Date.now() - startTime < MAX_MEETING_DURATION_MS) {
        if (!stopRequested) {
          // Check if the meeting was manually stopped via the API
          const meeting = await prisma.meeting.findUnique({
            where: { id: meetingId },
            select: { status: true },
          })

          if (!meeting || meeting.status === 'PROCESSING' || meeting.status === 'FAILED') {
            stopRequested = true
          }
        }

        if (stopRequested && !stopCommandIssued) {
          try {
            await botClient.stopSession(session.id)
            stopCommandIssued = true
          } catch (err) {
            logger.warn(`[MeetingBotWorker] Failed to stop session ${session.id}, retrying...`, err)
          }
        }

        // Check bot session status
        let currentSession
        try {
          currentSession = await botClient.getSession(session.id)
        } catch {
          // Bot service may be unavailable — retry
          logger.warn(`[MeetingBotWorker] Failed to poll session ${session.id}, retrying...`)
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        if (currentSession.status === 'ended' || currentSession.status === 'error') {
          break
        }

        await sleep(POLL_INTERVAL_MS)
      }

      // Step 4: Fetch final session with complete transcript
      let finalSession
      try {
        finalSession = await getSessionWithRetries(
          botClient,
          session.id,
          FINAL_SESSION_RETRY_ATTEMPTS
        )
      } catch (err) {
        logger.error(`[MeetingBotWorker] Failed to fetch final session ${session.id}:`, err)
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'FAILED' },
        })
        throw err
      }
      const transcript = finalSession.transcript ?? []

      // Step 5: Save raw transcript to the database
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          raw_transcript: transcript as unknown as Prisma.InputJsonValue,
          status: 'PROCESSING',
          ended_at: finalSession.endedAt ? new Date(finalSession.endedAt) : new Date(),
        },
      })

      logger.log(
        `[MeetingBotWorker] Meeting ${meetingId} ended, saved ${transcript.length} transcript segments`
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
        logger.warn(
          `[MeetingBotWorker] Queue manager unavailable, processing meeting ${meetingId} inline`
        )
        await meetingProcessingService.processMeeting(meetingId)
        logger.log(`[MeetingBotWorker] Completed inline processing for meeting ${meetingId}`)
      }

      return { success: true, meetingId, segments: transcript.length }
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

async function getSessionWithRetries(
  botClient: MeetingBotClient,
  sessionId: string,
  attempts: number
): Promise<Awaited<ReturnType<MeetingBotClient['getSession']>>> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await botClient.getSession(sessionId)
    } catch (error) {
      lastError = error
      if (attempt === attempts) {
        break
      }

      logger.warn(
        `[MeetingBotWorker] Failed to fetch session ${sessionId} (attempt ${attempt}/${attempts}), retrying...`,
        error
      )
      await sleep(POLL_INTERVAL_MS)
    }
  }

  throw lastError
}
