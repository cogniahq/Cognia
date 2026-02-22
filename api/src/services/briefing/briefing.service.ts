import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { BriefingType } from '@prisma/client'

interface CreateBriefingData {
  userId: string
  organizationId?: string
  briefingType: BriefingType
  periodStart: Date
  periodEnd: Date
  summary: string
  topics: unknown
  wowFacts?: unknown
  knowledgeGaps?: unknown
  connections?: unknown
  expertUpdates?: unknown
}

interface ListBriefingsOptions {
  type?: BriefingType
  limit?: number
  offset?: number
}

interface UpdatePreferencesData {
  dailyDigest?: boolean
  weeklySynthesis?: boolean
  trendAlerts?: boolean
  teamReports?: boolean
  digestHour?: number
  timezone?: string
}

class BriefingService {
  async createBriefing(data: CreateBriefingData) {
    logger.info({ userId: data.userId, type: data.briefingType }, 'Creating briefing')

    const briefing = await prisma.intelligenceBriefing.create({
      data: {
        user_id: data.userId,
        organization_id: data.organizationId,
        briefing_type: data.briefingType,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        summary: data.summary,
        topics: data.topics as any,
        wow_facts: data.wowFacts as any,
        knowledge_gaps: data.knowledgeGaps as any,
        connections: data.connections as any,
        expert_updates: data.expertUpdates as any,
      },
    })

    logger.info({ briefingId: briefing.id }, 'Briefing created')
    return briefing
  }

  async listBriefings(userId: string, options: ListBriefingsOptions = {}) {
    const { type, limit = 20, offset = 0 } = options

    const where = {
      user_id: userId,
      ...(type && { briefing_type: type }),
    }

    const [briefings, total] = await Promise.all([
      prisma.intelligenceBriefing.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.intelligenceBriefing.count({ where }),
    ])

    return { briefings, total }
  }

  async getLatestBriefings(userId: string) {
    const types = Object.values(BriefingType)

    const results = await Promise.all(
      types.map(type =>
        prisma.intelligenceBriefing.findFirst({
          where: { user_id: userId, briefing_type: type },
          orderBy: { created_at: 'desc' },
        })
      )
    )

    const latest: Partial<
      Record<BriefingType, Awaited<ReturnType<typeof prisma.intelligenceBriefing.findFirst>>>
    > = {}

    for (let i = 0; i < types.length; i++) {
      if (results[i]) {
        latest[types[i]] = results[i]
      }
    }

    return latest
  }

  async getBriefing(id: string, userId: string) {
    return prisma.intelligenceBriefing.findFirst({
      where: { id, user_id: userId },
    })
  }

  async markAsRead(id: string, userId: string) {
    return prisma.intelligenceBriefing.updateMany({
      where: { id, user_id: userId, read_at: null },
      data: { read_at: new Date() },
    })
  }

  async getUnreadCount(userId: string) {
    return prisma.intelligenceBriefing.count({
      where: { user_id: userId, read_at: null },
    })
  }

  async getOrCreatePreferences(userId: string) {
    const existing = await prisma.notificationPreferences.findUnique({
      where: { user_id: userId },
    })

    if (existing) return existing

    return prisma.notificationPreferences.create({
      data: { user_id: userId },
    })
  }

  async updatePreferences(userId: string, data: UpdatePreferencesData) {
    return prisma.notificationPreferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        ...(data.dailyDigest !== undefined && { daily_digest: data.dailyDigest }),
        ...(data.weeklySynthesis !== undefined && { weekly_synthesis: data.weeklySynthesis }),
        ...(data.trendAlerts !== undefined && { trend_alerts: data.trendAlerts }),
        ...(data.teamReports !== undefined && { team_reports: data.teamReports }),
        ...(data.digestHour !== undefined && { digest_hour: data.digestHour }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
      },
      update: {
        ...(data.dailyDigest !== undefined && { daily_digest: data.dailyDigest }),
        ...(data.weeklySynthesis !== undefined && { weekly_synthesis: data.weeklySynthesis }),
        ...(data.trendAlerts !== undefined && { trend_alerts: data.trendAlerts }),
        ...(data.teamReports !== undefined && { team_reports: data.teamReports }),
        ...(data.digestHour !== undefined && { digest_hour: data.digestHour }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
      },
    })
  }

  async hasRecentBriefing(userId: string, type: BriefingType, since: Date) {
    const count = await prisma.intelligenceBriefing.count({
      where: {
        user_id: userId,
        briefing_type: type,
        created_at: { gte: since },
      },
    })

    return count > 0
  }
}

export const briefingService = new BriefingService()
