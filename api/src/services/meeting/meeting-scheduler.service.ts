import { prisma } from '../../lib/prisma.lib'
import { PluginRegistry, GoogleCalendarPlugin } from '@cogniahq/integrations'
import { integrationService } from '../integration'
import { meetingService } from './meeting.service'
import { logger } from '../../utils/core/logger.util'

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MINUTES_AHEAD = 10

/**
 * Cron-like scheduler that checks upcoming calendar events
 * and auto-joins meetings for users with the setting enabled.
 */
class MeetingSchedulerService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null

  /**
   * Start the scheduler (called on app startup).
   */
  start(): void {
    if (this.intervalHandle) return

    this.intervalHandle = setInterval(() => {
      this.checkUpcomingMeetings().catch(err => {
        logger.error('[MeetingScheduler] Error checking upcoming meetings:', err)
      })
    }, CHECK_INTERVAL_MS)

    logger.log('[MeetingScheduler] Started, checking every 5 minutes')
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  /**
   * Check all users with google_calendar integration for upcoming meetings.
   */
  private async checkUpcomingMeetings(): Promise<void> {
    // Find all active Google Calendar integrations
    const integrations = await prisma.userIntegration.findMany({
      where: {
        provider: 'google_calendar',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        user_id: true,
        access_token: true,
        refresh_token: true,
        token_expires_at: true,
        config: true,
      },
    })

    for (const integration of integrations) {
      try {
        // Check if user has auto-join enabled
        const config = integration.config as Record<string, unknown> | null
        if (!config?.autoJoinMeetings) continue

        // Get decrypted tokens
        const tokens = integrationService.getDecryptedTokensPublic(integration)

        // Get the Google Calendar plugin
        const plugin = PluginRegistry.get('google_calendar') as GoogleCalendarPlugin
        if (!plugin) continue

        // Get upcoming meetings with meeting links
        const upcomingMeetings = await plugin.getUpcomingMeetings(tokens, MINUTES_AHEAD)

        for (const event of upcomingMeetings) {
          if (!event.meetingLink) continue

          // Check if we're within 5 minutes of the start
          const minutesUntilStart = (event.start.getTime() - Date.now()) / 60000
          if (minutesUntilStart > 5 || minutesUntilStart < -5) continue

          // Deduplication: skip if a meeting already exists for this calendar event
          const existing = await prisma.meeting.findFirst({
            where: {
              user_id: integration.user_id,
              calendar_event_id: event.id,
            },
          })

          if (existing) continue

          // Look up the user's organization for linking
          const membership = await prisma.organizationMember.findFirst({
            where: { user_id: integration.user_id },
            select: { organization_id: true },
          })

          // Auto-join the meeting
          await meetingService.startMeeting({
            userId: integration.user_id,
            meetingUrl: event.meetingLink.url,
            organizationId: membership?.organization_id,
            calendarEventId: event.id,
            title: event.summary,
          })

          logger.log(`[MeetingScheduler] Auto-joined meeting for user ${integration.user_id}: ${event.summary}`)
        }
      } catch (err) {
        logger.error(`[MeetingScheduler] Error for integration ${integration.id}:`, err)
      }
    }
  }
}

export const meetingSchedulerService = new MeetingSchedulerService()
