import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import { briefingGenerationService } from '../services/briefing/briefing-generation.service'
import { briefingService } from '../services/briefing/briefing.service'
import { BriefingType } from '@prisma/client'

const INTERVAL_MS = 3_600_000 // 1 hour
const STARTUP_DELAY_MS = 30_000 // 30 seconds

let workerInterval: NodeJS.Timeout | null = null

export function startBriefingWorker() {
  setTimeout(() => runBriefingCycle(), STARTUP_DELAY_MS)
  workerInterval = setInterval(() => runBriefingCycle(), INTERVAL_MS)
  return workerInterval
}

export function stopBriefingWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
}

export async function runBriefingCycle() {
  const start = Date.now()
  logger.log('[briefing-worker] cycle started')

  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, created_at: true },
    })

    const currentHour = new Date().getUTCHours()

    for (const user of users) {
      try {
        await processUser(user.id, currentHour)
      } catch (error) {
        logger.error(
          `[briefing-worker] user=${user.id} error="${error instanceof Error ? error.message : String(error)}"`
        )
      }
    }

    const elapsed = Date.now() - start
    logger.log(`[briefing-worker] cycle completed in ${elapsed}ms, users=${users.length}`)
  } catch (error) {
    logger.error(
      `[briefing-worker] cycle failed error="${error instanceof Error ? error.message : String(error)}"`
    )
  }
}

async function processUser(userId: string, currentHour: number) {
  const prefs = await briefingService.getOrCreatePreferences(userId)

  const isDigestHour = prefs.digest_hour === currentHour
  if (!isDigestHour) return

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setUTCHours(23, 59, 59, 999)

  // Daily digest
  if (prefs.daily_digest) {
    const alreadyExists = await briefingService.hasRecentBriefing(
      userId,
      BriefingType.DAILY_DIGEST,
      todayStart
    )

    if (!alreadyExists) {
      const memoryCount = await prisma.memory.count({ where: { user_id: userId } })

      if (memoryCount > 10) {
        const result = await briefingGenerationService.generateDailyDigest(
          userId,
          todayStart,
          todayEnd
        )

        if (result) {
          await briefingService.createBriefing({
            userId,
            briefingType: BriefingType.DAILY_DIGEST,
            periodStart: todayStart,
            periodEnd: todayEnd,
            summary: result.summary,
            topics: result.topics,
            wowFacts: result.wow_facts,
            knowledgeGaps: result.knowledge_gaps,
            connections: result.connections,
          })
          logger.log(`[briefing-worker] created DAILY_DIGEST for user=${userId}`)
        }
      }
    }
  }

  // Weekly synthesis on Sundays
  if (prefs.weekly_synthesis && now.getUTCDay() === 0) {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const alreadyExists = await briefingService.hasRecentBriefing(
      userId,
      BriefingType.WEEKLY_SYNTHESIS,
      todayStart
    )

    if (!alreadyExists) {
      const result = await briefingGenerationService.generateWeeklySynthesis(userId, weekAgo, now)

      if (result) {
        await briefingService.createBriefing({
          userId,
          briefingType: BriefingType.WEEKLY_SYNTHESIS,
          periodStart: weekAgo,
          periodEnd: now,
          summary: result.summary,
          topics: result.topics,
          wowFacts: result.wow_facts,
          knowledgeGaps: result.knowledge_gaps,
          connections: result.connections,
        })
        logger.log(`[briefing-worker] created WEEKLY_SYNTHESIS for user=${userId}`)
      }
    }
  }

  // Trend detection
  if (prefs.trend_alerts) {
    const trends = await briefingGenerationService.detectTrends(userId)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    for (const trend of trends) {
      const existingAlerts = await prisma.intelligenceBriefing.findMany({
        where: {
          user_id: userId,
          briefing_type: BriefingType.TREND_ALERT,
          created_at: { gte: sevenDaysAgo },
        },
      })

      const alreadyAlerted = existingAlerts.some(alert => {
        const topics = alert.topics as Array<{ topic?: string }> | null
        return topics?.some(t => t.topic?.toLowerCase() === trend.topic.toLowerCase())
      })

      if (!alreadyAlerted) {
        await briefingService.createBriefing({
          userId,
          briefingType: BriefingType.TREND_ALERT,
          periodStart: sevenDaysAgo,
          periodEnd: now,
          summary: `Trending topic detected: "${trend.topic}" appeared in ${trend.memoryCount} memories across ${trend.dayCount} days.`,
          topics: [
            { topic: trend.topic, memoryCount: trend.memoryCount, trend: 'rising' as const },
          ],
        })
        logger.log(
          `[briefing-worker] created TREND_ALERT for user=${userId} topic="${trend.topic}"`
        )
      }
    }
  }

  // Team report on Mondays
  if (prefs.team_reports && now.getUTCDay() === 1) {
    const memberships = await prisma.organizationMember.findMany({
      where: { user_id: userId },
      select: { organization_id: true },
    })

    for (const membership of memberships) {
      const orgId = membership.organization_id

      const memberCount = await prisma.organizationMember.count({
        where: { organization_id: orgId },
      })

      if (memberCount < 2) continue

      const alreadyExists = await briefingService.hasRecentBriefing(
        userId,
        BriefingType.TEAM_REPORT,
        todayStart
      )

      if (alreadyExists) continue

      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)

      const result = await briefingGenerationService.generateTeamReport(orgId, weekAgo, now)

      if (result) {
        await briefingService.createBriefing({
          userId,
          organizationId: orgId,
          briefingType: BriefingType.TEAM_REPORT,
          periodStart: weekAgo,
          periodEnd: now,
          summary: result.summary,
          topics: result.topics,
          wowFacts: result.wow_facts,
          knowledgeGaps: result.knowledge_gaps,
          connections: result.connections,
          expertUpdates: result.expert_updates,
        })
        logger.log(`[briefing-worker] created TEAM_REPORT for user=${userId} org=${orgId}`)
      }
    }
  }
}
