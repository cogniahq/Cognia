import { prisma } from '../../lib/prisma.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'

interface TopicEntry {
  topic: string
  memoryCount: number
  trend: 'rising' | 'stable' | 'new'
}

interface KnowledgeGap {
  topic: string
  suggestion: string
  reason: string
}

interface Connection {
  memoryA: string
  memoryB: string
  insight: string
}

interface BriefingResult {
  summary: string
  topics: TopicEntry[]
  wow_facts: string[]
  knowledge_gaps: KnowledgeGap[]
  connections: Connection[]
}

interface TeamBriefingResult extends BriefingResult {
  expert_updates: {
    userId: string
    name: string
    topics: string[]
    newMemories: number
  }[]
}

interface TrendResult {
  topic: string
  memoryCount: number
  dayCount: number
}

const EMPTY_BRIEFING: BriefingResult = {
  summary: '',
  topics: [],
  wow_facts: [],
  knowledge_gaps: [],
  connections: [],
}

class BriefingGenerationService {
  async generateDailyDigest(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BriefingResult | null> {
    const memories = await prisma.memory.findMany({
      where: {
        user_id: userId,
        created_at: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { created_at: 'desc' },
    })

    if (memories.length === 0) {
      return null
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: userId },
    })

    const memorySummaries = memories.map(m => {
      const meta = m.page_metadata as Record<string, unknown> | null
      const topics = (meta?.topics as string[]) || []
      const categories = (meta?.categories as string[]) || []
      return `- "${m.title || 'Untitled'}" (source: ${m.source_type || m.source})${topics.length ? ` [topics: ${topics.join(', ')}]` : ''}${categories.length ? ` [categories: ${categories.join(', ')}]` : ''}`
    })

    const profileContext = userProfile?.static_profile_text
      ? `\nUser profile context: ${userProfile.static_profile_text}\n`
      : ''

    const prompt = `You are an intelligence analyst generating a daily briefing.
${profileContext}
The user captured ${memories.length} memories today. Here they are:
${memorySummaries.join('\n')}

Respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "summary": "2-3 sentence narrative of the day's learning activity and key themes",
  "topics": [{"topic": "string", "memoryCount": number, "trend": "rising"|"stable"|"new"}],
  "wow_facts": ["1-2 surprising or noteworthy insights from the memories"],
  "knowledge_gaps": [{"topic": "string", "suggestion": "what to explore next", "reason": "why this gap matters"}],
  "connections": [{"memoryA": "title of first memory", "memoryB": "title of second memory", "insight": "how they connect"}]
}`

    const response = await aiProvider.generateContent(prompt, false, userId)
    return this.parseAIJson<BriefingResult>(response, { ...EMPTY_BRIEFING })
  }

  async generateWeeklySynthesis(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BriefingResult | null> {
    const thisWeekMemories = await prisma.memory.findMany({
      where: {
        user_id: userId,
        created_at: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { created_at: 'desc' },
    })

    if (thisWeekMemories.length === 0) {
      return null
    }

    const prevWeekStart = new Date(periodStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)

    const prevWeekMemories = await prisma.memory.findMany({
      where: {
        user_id: userId,
        created_at: { gte: prevWeekStart, lt: periodStart },
      },
      orderBy: { created_at: 'desc' },
    })

    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: userId },
    })

    const formatMemories = (mems: typeof thisWeekMemories): string => {
      return mems
        .map(m => {
          const meta = m.page_metadata as Record<string, unknown> | null
          const topics = (meta?.topics as string[]) || []
          return `- "${m.title || 'Untitled'}"${topics.length ? ` [topics: ${topics.join(', ')}]` : ''}`
        })
        .join('\n')
    }

    const profileContext = userProfile?.static_profile_text
      ? `\nUser profile context: ${userProfile.static_profile_text}\n`
      : ''

    const prompt = `You are an intelligence analyst generating a weekly synthesis briefing.
${profileContext}
THIS WEEK (${thisWeekMemories.length} memories):
${formatMemories(thisWeekMemories)}

PREVIOUS WEEK (${prevWeekMemories.length} memories):
${formatMemories(prevWeekMemories)}

Compare both weeks. Identify what topics are new this week, what evolved from last week, and what was dropped.

Respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "summary": "2-3 sentence narrative focusing on evolution of interests and learning trajectory",
  "topics": [{"topic": "string", "memoryCount": number, "trend": "rising"|"stable"|"new"}],
  "wow_facts": ["1-2 surprising insights or notable shifts between weeks"],
  "knowledge_gaps": [{"topic": "string", "suggestion": "what to explore next", "reason": "why this gap matters"}],
  "connections": [{"memoryA": "title of first memory", "memoryB": "title of second memory", "insight": "how they connect across weeks"}]
}`

    const response = await aiProvider.generateContent(prompt, false, userId)
    return this.parseAIJson<BriefingResult>(response, { ...EMPTY_BRIEFING })
  }

  async detectTrends(userId: string): Promise<TrendResult[]> {
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const memories = await prisma.memory.findMany({
      where: {
        user_id: userId,
        created_at: { gte: fourteenDaysAgo },
      },
      select: {
        page_metadata: true,
        created_at: true,
      },
    })

    const topicMap = new Map<string, { memoryCount: number; days: Set<string> }>()

    for (const memory of memories) {
      const meta = memory.page_metadata as Record<string, unknown> | null
      const topics = (meta?.topics as string[]) || []
      const dayKey = memory.created_at.toISOString().slice(0, 10)

      for (const topic of topics) {
        const normalized = topic.toLowerCase().trim()
        if (!normalized) continue

        const entry = topicMap.get(normalized) || {
          memoryCount: 0,
          days: new Set<string>(),
        }
        entry.memoryCount++
        entry.days.add(dayKey)
        topicMap.set(normalized, entry)
      }
    }

    const results: TrendResult[] = []

    for (const [topic, data] of topicMap) {
      if (data.memoryCount >= 5 && data.days.size >= 3) {
        results.push({
          topic,
          memoryCount: data.memoryCount,
          dayCount: data.days.size,
        })
      }
    }

    results.sort((a, b) => b.memoryCount - a.memoryCount)

    return results
  }

  async generateTeamReport(
    orgId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<TeamBriefingResult | null> {
    const memories = await prisma.memory.findMany({
      where: {
        organization_id: orgId,
        created_at: { gte: periodStart, lte: periodEnd },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    if (memories.length === 0) {
      return null
    }

    const memberMap = new Map<
      string,
      {
        name: string
        topics: Set<string>
        memoryCount: number
      }
    >()

    const allMemorySummaries: string[] = []

    for (const m of memories) {
      const meta = m.page_metadata as Record<string, unknown> | null
      const topics = (meta?.topics as string[]) || []

      const member = memberMap.get(m.user_id) || {
        name: m.user?.name || m.user?.email || 'Unknown',
        topics: new Set<string>(),
        memoryCount: 0,
      }
      member.memoryCount++
      for (const t of topics) member.topics.add(t)
      memberMap.set(m.user_id, member)

      allMemorySummaries.push(
        `- [${member.name}] "${m.title || 'Untitled'}"${topics.length ? ` [topics: ${topics.join(', ')}]` : ''}`
      )
    }

    const memberSummaries = Array.from(memberMap.entries())
      .map(
        ([, data]) =>
          `- ${data.name}: ${data.memoryCount} memories, topics: ${[...data.topics].join(', ') || 'none'}`
      )
      .join('\n')

    const prompt = `You are an intelligence analyst generating a team knowledge report.

Team has ${memberMap.size} active members who captured ${memories.length} total memories.

MEMBER OVERVIEW:
${memberSummaries}

ALL MEMORIES:
${allMemorySummaries.join('\n')}

Respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "summary": "2-3 sentence narrative of the team's collective learning and key themes",
  "topics": [{"topic": "string", "memoryCount": number, "trend": "rising"|"stable"|"new"}],
  "wow_facts": ["1-2 surprising team-level insights"],
  "knowledge_gaps": [{"topic": "string", "suggestion": "what the team should explore", "reason": "why this matters for the team"}],
  "connections": [{"memoryA": "title", "memoryB": "title", "insight": "how different members' research connects"}]
}`

    const response = await aiProvider.generateContent(prompt)
    const baseBriefing = this.parseAIJson<BriefingResult>(response, {
      ...EMPTY_BRIEFING,
    })

    const expert_updates = Array.from(memberMap.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
      topics: [...data.topics],
      newMemories: data.memoryCount,
    }))

    return {
      ...baseBriefing,
      expert_updates,
    }
  }

  private parseAIJson<T>(response: string, fallback: T): T {
    try {
      let jsonStr = response.trim()
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
      }
      return JSON.parse(jsonStr)
    } catch {
      logger.warn('[briefing-generation] failed to parse AI response, using fallback')
      return fallback
    }
  }
}

export const briefingGenerationService = new BriefingGenerationService()
