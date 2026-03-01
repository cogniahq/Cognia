import { prisma } from '../../lib/prisma.lib'
import { integrationService } from '../integration'
import { MeetingBotClient } from '@cogniahq/integrations'
import { logger } from '../../utils/core/logger.util'
import type { MeetingBotJobData } from '@cogniahq/integrations'

const BOT_SERVICE_URL = process.env.MEETING_BOT_SERVICE_URL || 'http://localhost:3100'

/**
 * Orchestrates the meeting lifecycle:
 * create record → enqueue bot job → update status on callbacks.
 */
class MeetingService {
  /**
   * Detect platform from a meeting URL.
   */
  detectPlatform(url: string): 'google_meet' | 'zoom' {
    if (url.includes('meet.google.com')) return 'google_meet'
    if (url.includes('zoom.us') || url.includes('zoom.com')) return 'zoom'
    throw new Error('Unsupported meeting platform. Only Google Meet and Zoom are supported.')
  }

  /**
   * Validate a meeting URL.
   */
  validateMeetingUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return (
        parsed.hostname.includes('meet.google.com') ||
        parsed.hostname.includes('zoom.us') ||
        parsed.hostname.includes('zoom.com')
      )
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
    const platform = this.detectPlatform(params.meetingUrl)

    // Check for duplicate (same URL, not completed/failed)
    const existing = await prisma.meeting.findFirst({
      where: {
        user_id: params.userId,
        meeting_url: params.meetingUrl,
        status: { in: ['JOINING', 'IN_MEETING'] },
      },
    })

    if (existing) {
      return existing
    }

    // Create meeting record
    const meeting = await prisma.meeting.create({
      data: {
        user_id: params.userId,
        organization_id: params.organizationId,
        meeting_url: params.meetingUrl,
        platform,
        calendar_event_id: params.calendarEventId,
        title: params.title,
        status: 'JOINING',
        started_at: new Date(),
      },
    })

    // Enqueue bot join job (fire-and-forget)
    try {
      const queueManager = integrationService.getQueueManager()
      if (queueManager) {
        const jobData: MeetingBotJobData = {
          meetingId: meeting.id,
          meetingUrl: params.meetingUrl,
          platform,
          userId: params.userId,
          organizationId: params.organizationId,
          calendarEventId: params.calendarEventId,
          botName: params.title ? `Cognia (${params.title})` : 'Cognia Notetaker',
        }
        await queueManager.addMeetingBotJob(jobData)
      }
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
        const botClient = new MeetingBotClient(BOT_SERVICE_URL)
        await botClient.stopSession(meeting.bot_session_id)
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
