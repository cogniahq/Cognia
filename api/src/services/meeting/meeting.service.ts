import { prisma } from '../../lib/prisma.lib'
import { Prisma } from '@prisma/client'
import { integrationService } from '../integration'
import { MeetingBotClient } from '@cogniahq/integrations'
import { logger } from '../../utils/core/logger.util'
import type { MeetingBotJobData } from '@cogniahq/integrations'

const BOT_SERVICE_URL = process.env.MEETING_BOT_SERVICE_URL || 'http://localhost:3100'
const GOOGLE_MEET_HOST = 'meet.google.com'
const ZOOM_HOST_SUFFIXES = ['zoom.us', 'zoom.com']
const BOT_HEALTH_CACHE_MS = Number(process.env.MEETING_BOT_HEALTH_CACHE_MS || 10000)

const normalizeMeetingUrl = (url: string) => url.trim()

const isGoogleMeetHost = (hostname: string) => hostname === GOOGLE_MEET_HOST

const isZoomHost = (hostname: string) =>
  ZOOM_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))

const parseMeetingPlatform = (url: string): 'google_meet' | 'zoom' => {
  const hostname = new URL(url).hostname.toLowerCase()

  if (isGoogleMeetHost(hostname)) return 'google_meet'
  if (isZoomHost(hostname)) return 'zoom'

  throw new Error('Unsupported meeting platform. Only Google Meet and Zoom are supported.')
}

const formatMeetingBotError = (error: unknown): string => {
  const message = error instanceof Error && error.message ? error.message : 'Unknown error'
  return message.startsWith('Meeting bot unavailable:')
    ? message
    : `Meeting bot unavailable: ${message}`
}

const acquireMeetingStartLock = async (
  tx: Prisma.TransactionClient,
  userId: string,
  meetingUrl: string
) => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${meetingUrl}))
  `
}

/**
 * Orchestrates the meeting lifecycle:
 * create record → enqueue bot job → update status on callbacks.
 */
class MeetingService {
  private readonly botClient = new MeetingBotClient(BOT_SERVICE_URL)
  private botHealthCheckedAt = 0
  private lastBotHealthError: string | null = null
  private botHealthCheckPromise: Promise<void> | null = null

  private async ensureBotAvailable(): Promise<void> {
    const now = Date.now()
    const cacheAge = now - this.botHealthCheckedAt

    if (this.botHealthCheckPromise) {
      return this.botHealthCheckPromise
    }

    if (cacheAge < BOT_HEALTH_CACHE_MS) {
      if (this.lastBotHealthError) {
        throw new Error(this.lastBotHealthError)
      }
      return
    }

    this.botHealthCheckPromise = this.botClient
      .health()
      .then(health => {
        if (health.status !== 'ok' && health.status !== 'degraded') {
          throw new Error(`Bot service reported status "${health.status}"`)
        }

        this.lastBotHealthError = null
        this.botHealthCheckedAt = Date.now()
      })
      .catch(error => {
        const message = formatMeetingBotError(error)
        this.lastBotHealthError = message
        this.botHealthCheckedAt = Date.now()
        throw new Error(message)
      })
      .finally(() => {
        this.botHealthCheckPromise = null
      })

    return this.botHealthCheckPromise
  }

  /**
   * Detect platform from a meeting URL.
   */
  detectPlatform(url: string): 'google_meet' | 'zoom' {
    return parseMeetingPlatform(normalizeMeetingUrl(url))
  }

  /**
   * Validate a meeting URL.
   */
  validateMeetingUrl(url: string): boolean {
    try {
      parseMeetingPlatform(normalizeMeetingUrl(url))
      return true
    } catch {
      return false
    }
  }

  /**
   * Start a new meeting — creates DB record and enqueues the bot join job.
   */
  async startMeeting(params: {
    userId: string
    meetingUrl: string
    organizationId?: string
    calendarEventId?: string
    title?: string
  }) {
    const normalizedMeetingUrl = normalizeMeetingUrl(params.meetingUrl)
    const platform = this.detectPlatform(normalizedMeetingUrl)

    const existingMeeting = await prisma.meeting.findFirst({
      where: {
        user_id: params.userId,
        meeting_url: normalizedMeetingUrl,
        status: { in: ['JOINING', 'IN_MEETING'] },
      },
    })

    if (existingMeeting) {
      return existingMeeting
    }

    const queueManager = integrationService.getQueueManager()
    if (!queueManager) {
      throw new Error('Meeting system unavailable: queue manager is not initialized')
    }

    await this.ensureBotAvailable()

    const { meeting, wasExisting } = await prisma.$transaction(
      async tx => {
        await acquireMeetingStartLock(tx, params.userId, normalizedMeetingUrl)

        // Check for duplicate (same URL, not completed/failed)
        const existing = await tx.meeting.findFirst({
          where: {
            user_id: params.userId,
            meeting_url: normalizedMeetingUrl,
            status: { in: ['JOINING', 'IN_MEETING'] },
          },
        })

        if (existing) {
          return {
            meeting: existing,
            wasExisting: true,
          }
        }

        const meeting = await tx.meeting.create({
          data: {
            user_id: params.userId,
            organization_id: params.organizationId,
            meeting_url: normalizedMeetingUrl,
            platform,
            calendar_event_id: params.calendarEventId,
            title: params.title,
            status: 'JOINING',
            started_at: new Date(),
          },
        })

        return {
          meeting,
          wasExisting: false,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    if (wasExisting) {
      return meeting
    }

    // Enqueue bot join job (fire-and-forget)
    try {
      const jobData: MeetingBotJobData = {
        meetingId: meeting.id,
        meetingUrl: normalizedMeetingUrl,
        platform,
        userId: params.userId,
        organizationId: params.organizationId,
        calendarEventId: params.calendarEventId,
        botName: params.title ? `Cognia (${params.title})` : 'Cognia Notetaker',
      }
      await queueManager.addMeetingBotJob(jobData)
    } catch (err) {
      logger.error('[MeetingService] Failed to enqueue bot job:', err)
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { status: 'FAILED' },
      })
      throw new Error('Failed to start meeting bot')
    }

    return meeting
  }

  /**
   * Stop an active meeting session.
   * 1. Tells the bot service to leave the meeting
   * 2. Updates DB status to PROCESSING (the bot worker's poll loop will detect this
   *    and proceed to fetch final transcript + enqueue processing)
   */
  async stopMeeting(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, user_id: userId },
    })

    if (!meeting) {
      throw new Error('Meeting not found')
    }

    if (meeting.status === 'COMPLETED' || meeting.status === 'FAILED') {
      throw new Error('Meeting already ended')
    }

    // Tell the bot service to leave the meeting
    if (meeting.bot_session_id) {
      try {
        await this.botClient.stopSession(meeting.bot_session_id)
      } catch (err) {
        logger.warn(`[MeetingService] Failed to stop bot session ${meeting.bot_session_id}:`, err)
        // Continue anyway — the bot worker will handle cleanup
      }
    }

    // Update status — the bot worker's poll loop will detect PROCESSING status,
    // fetch the final transcript from the bot service, and enqueue AI processing
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'PROCESSING',
        ended_at: new Date(),
      },
    })

    return { success: true }
  }

  /**
   * List meetings for a user.
   */
  async listMeetings(userId: string, limit: number = 50, offset: number = 0) {
    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          meeting_url: true,
          platform: true,
          status: true,
          title: true,
          started_at: true,
          ended_at: true,
          created_at: true,
          calendar_event_id: true,
        },
      }),
      prisma.meeting.count({ where: { user_id: userId } }),
    ])

    return { meetings, total }
  }

  /**
   * Get a single meeting with full details.
   */
  async getMeeting(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, user_id: userId },
    })

    if (!meeting) {
      throw new Error('Meeting not found')
    }

    return meeting
  }
}

export const meetingService = new MeetingService()
