import { prisma } from '../lib/prisma.lib'
import { profileExtractionService, ProfileExtractionResult } from './profile-extraction.service'
import { getRedisClient } from '../lib/redis.lib'
import { logger } from '../utils/logger.util'
import { Prisma } from '@prisma/client'

export interface UserProfile {
  id: string
  user_id: string
  static_profile_json: Prisma.JsonValue
  static_profile_text: string | null
  dynamic_profile_json: Prisma.JsonValue
  dynamic_profile_text: string | null
  last_updated: Date
  last_memory_analyzed: Date | null
  version: number
}

const PROFILE_CACHE_PREFIX = 'user_profile:'
const PROFILE_CACHE_TTL = 10 * 60 // 10 minutes in seconds
const PROFILE_CONTEXT_CACHE_PREFIX = 'user_profile_context:'
const PROFILE_CONTEXT_CACHE_TTL = 5 * 60 // 5 minutes in seconds

function getProfileCacheKey(userId: string): string {
  return `${PROFILE_CACHE_PREFIX}${userId}`
}

function getProfileContextCacheKey(userId: string): string {
  return `${PROFILE_CONTEXT_CACHE_PREFIX}${userId}`
}

async function invalidateProfileCache(userId: string): Promise<void> {
  try {
    const client = getRedisClient()
    await Promise.all([
      client.del(getProfileCacheKey(userId)),
      client.del(getProfileContextCacheKey(userId)),
    ])
  } catch (error) {
    logger.warn('[profile] cache invalidation error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export class ProfileUpdateService {
  async updateUserProfile(userId: string, force: boolean = false): Promise<UserProfile> {
    const existingProfile = await prisma.userProfile.findUnique({
      where: { user_id: userId },
    })

    // Get all memories to understand the full scope
    const allMemoriesRaw = await prisma.memory.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        title: true,
        content: true,
        created_at: true,
        page_metadata: true,
      },
      orderBy: { created_at: 'desc' },
    })

    if (allMemoriesRaw.length === 0) {
      throw new Error('No memories found for user')
    }

    const lastAnalyzedDate = force ? null : existingProfile?.last_memory_analyzed || null
    const now = new Date()

    // Dynamically select memories based on profile state and activity
    const selectedMemories = this.selectMemoriesDynamically(
      allMemoriesRaw,
      existingProfile,
      lastAnalyzedDate,
      now
    )

    if (selectedMemories.length === 0 && existingProfile && !force) {
      return existingProfile as UserProfile
    }

    let extractionResult: ProfileExtractionResult

    try {
      extractionResult = await profileExtractionService.extractProfileFromMemories(
        userId,
        selectedMemories,
        existingProfile
      )
    } catch (error) {
      logger.error('Error extracting profile, retrying once:', error)

      try {
        extractionResult = await profileExtractionService.extractProfileFromMemories(
          userId,
          selectedMemories,
          existingProfile
        )
      } catch (retryError) {
        logger.error('Error extracting profile on retry:', retryError)

        if (existingProfile) {
          logger.log('Preserving existing profile due to extraction failure')
          return existingProfile as UserProfile
        }

        throw new Error('Failed to extract profile and no existing profile to preserve')
      }
    }

    if (extractionResult.isFallback) {
      logger.warn('[Profile Extraction] Fallback used - preserving existing profile')
      if (existingProfile) {
        return existingProfile as UserProfile
      }
      throw new Error(
        'Failed to extract profile (fallback used) and no existing profile to preserve'
      )
    }

    if (existingProfile && !force && lastAnalyzedDate) {
      const merged = this.mergeProfiles(existingProfile, extractionResult)
      extractionResult = merged
    }

    const latestMemory =
      selectedMemories.length > 0
        ? selectedMemories[0]
        : allMemoriesRaw.length > 0
          ? allMemoriesRaw[0]
          : await prisma.memory.findFirst({
              where: { user_id: userId },
              orderBy: { created_at: 'desc' },
            })

    const profile = await prisma.userProfile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        static_profile_json: extractionResult.static_profile_json as unknown as Prisma.JsonValue,
        static_profile_text: extractionResult.static_profile_text,
        dynamic_profile_json: extractionResult.dynamic_profile_json as unknown as Prisma.JsonValue,
        dynamic_profile_text: extractionResult.dynamic_profile_text,
        last_memory_analyzed: latestMemory?.created_at || null,
        version: 1,
      },
      update: {
        static_profile_json: extractionResult.static_profile_json as unknown as Prisma.JsonValue,
        static_profile_text: extractionResult.static_profile_text,
        dynamic_profile_json: extractionResult.dynamic_profile_json as unknown as Prisma.JsonValue,
        dynamic_profile_text: extractionResult.dynamic_profile_text,
        last_memory_analyzed: latestMemory?.created_at || null,
        version: { increment: 1 },
      },
    })

    // Invalidate cache after profile update
    await invalidateProfileCache(userId)

    return profile as UserProfile
  }

  private selectMemoriesDynamically(
    allMemories: Array<{
      id: string
      title: string | null
      content: string
      created_at: Date
      page_metadata: Prisma.JsonValue
    }>,
    existingProfile: UserProfile | null,
    lastAnalyzedDate: Date | null,
    now: Date
  ): Array<{
    id: string
    title: string | null
    content: string
    created_at: Date
    page_metadata: Prisma.JsonValue
  }> {
    if (allMemories.length === 0) {
      return []
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Find the most recent memory to determine activity level
    const mostRecentMemory = allMemories[0]
    const daysSinceLastMemory =
      (now.getTime() - mostRecentMemory.created_at.getTime()) / (1000 * 60 * 60 * 24)
    const isVeryActive = daysSinceLastMemory <= 1 // Added memory in last 24 hours
    const isActive = daysSinceLastMemory <= 7 // Added memory in last week

    const selected: Array<{
      id: string
      title: string | null
      content: string
      created_at: Date
      page_metadata: Prisma.JsonValue
    }> = []
    const selectedIds = new Set<string>()

    // Strategy 1: If no existing profile, do comprehensive initial extraction
    if (!existingProfile || !lastAnalyzedDate) {
      // Include all very recent memories (last 7 days)
      const veryRecent = allMemories.filter(m => m.created_at >= sevenDaysAgo)
      veryRecent.forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Include most recent memories (7-30 days) - prioritize if active
      const recent = allMemories.filter(
        m => m.created_at >= thirtyDaysAgo && m.created_at < sevenDaysAgo
      )
      const recentToInclude = isVeryActive
        ? recent
        : recent.slice(0, Math.ceil(recent.length * 0.8))
      recentToInclude.forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Include diverse sample from 30-90 days
      const midTerm = allMemories.filter(
        m => m.created_at >= ninetyDaysAgo && m.created_at < thirtyDaysAgo
      )
      // Sample every 3rd memory to get diversity
      for (let i = 0; i < midTerm.length; i += 3) {
        const m = midTerm[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }

      // Include diverse sample from older memories (90 days - 1 year)
      const older = allMemories.filter(
        m => m.created_at >= oneYearAgo && m.created_at < ninetyDaysAgo
      )
      // Sample every 5th memory
      for (let i = 0; i < older.length; i += 5) {
        const m = older[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }

      // Include a few very old memories for historical context (beyond 1 year)
      const veryOld = allMemories.filter(m => m.created_at < oneYearAgo)
      // Sample every 10th memory
      for (let i = 0; i < veryOld.length; i += 10) {
        const m = veryOld[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }

      // Limit total to 200 for performance, but prioritize recent
      return selected.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 200)
    }

    // Strategy 2: If profile exists, focus on new memories + strategic older samples
    const newMemories = allMemories.filter(
      m => !lastAnalyzedDate || m.created_at > lastAnalyzedDate
    )

    // Always include all new memories since last analysis
    newMemories.forEach(m => {
      if (!selectedIds.has(m.id)) {
        selected.push(m)
        selectedIds.add(m.id)
      }
    })

    // If user is very active, focus heavily on recent memories
    if (isVeryActive) {
      // Include all memories from last 7 days
      const veryRecent = allMemories.filter(
        m => m.created_at >= sevenDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      veryRecent.forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Include most of recent memories (7-30 days)
      const recent = allMemories.filter(
        m =>
          m.created_at >= thirtyDaysAgo &&
          m.created_at < sevenDaysAgo &&
          (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      recent.slice(0, Math.ceil(recent.length * 0.9)).forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Light sampling of older memories for context
      const older = allMemories.filter(
        m => m.created_at < thirtyDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      for (let i = 0; i < older.length; i += 7) {
        const m = older[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }
    } else if (isActive) {
      // If moderately active, balance recent and historical
      const recent = allMemories.filter(
        m =>
          m.created_at >= thirtyDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      recent.slice(0, Math.ceil(recent.length * 0.8)).forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Moderate sampling of older memories
      const older = allMemories.filter(
        m => m.created_at < thirtyDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      for (let i = 0; i < older.length; i += 5) {
        const m = older[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }
    } else {
      // If less active, include more historical context to understand patterns
      const recent = allMemories.filter(
        m =>
          m.created_at >= thirtyDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      recent.forEach(m => {
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      })

      // Include more older memories for better context
      const older = allMemories.filter(
        m => m.created_at < thirtyDaysAgo && (!lastAnalyzedDate || m.created_at <= lastAnalyzedDate)
      )
      for (let i = 0; i < older.length; i += 3) {
        const m = older[i]
        if (!selectedIds.has(m.id)) {
          selected.push(m)
          selectedIds.add(m.id)
        }
      }
    }

    // Sort by recency and limit to reasonable size
    return selected.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 200)
  }

  private mergeProfiles(
    existing: {
      static_profile_json?: Prisma.JsonValue
      dynamic_profile_json?: Prisma.JsonValue
      static_profile_text?: string | null
      dynamic_profile_text?: string | null
    },
    newExtraction: ProfileExtractionResult
  ): ProfileExtractionResult {
    const existingStatic =
      existing.static_profile_json &&
      typeof existing.static_profile_json === 'object' &&
      existing.static_profile_json !== null &&
      !Array.isArray(existing.static_profile_json)
        ? (existing.static_profile_json as Record<string, unknown>)
        : {}
    const existingDynamic =
      existing.dynamic_profile_json &&
      typeof existing.dynamic_profile_json === 'object' &&
      existing.dynamic_profile_json !== null &&
      !Array.isArray(existing.dynamic_profile_json)
        ? (existing.dynamic_profile_json as Record<string, unknown>)
        : {}

    const existingInterests = Array.isArray(existingStatic.interests)
      ? (existingStatic.interests as string[])
      : []
    const existingSkills = Array.isArray(existingStatic.skills)
      ? (existingStatic.skills as string[])
      : []
    const existingLongTermPatterns = Array.isArray(existingStatic.long_term_patterns)
      ? (existingStatic.long_term_patterns as string[])
      : []
    const existingDomains = Array.isArray(existingStatic.domains)
      ? (existingStatic.domains as string[])
      : []
    const existingExpertiseAreas = Array.isArray(existingStatic.expertise_areas)
      ? (existingStatic.expertise_areas as string[])
      : []
    const existingPersonalityTraits = Array.isArray(existingStatic.personality_traits)
      ? (existingStatic.personality_traits as string[])
      : []
    const existingValuesAndPriorities = Array.isArray(existingStatic.values_and_priorities)
      ? (existingStatic.values_and_priorities as string[])
      : []
    const existingDemographics =
      existingStatic.demographics &&
      typeof existingStatic.demographics === 'object' &&
      existingStatic.demographics !== null &&
      !Array.isArray(existingStatic.demographics)
        ? (existingStatic.demographics as Record<string, unknown>)
        : {}

    const mergedStatic = {
      interests: this.mergeArrays(
        existingInterests,
        newExtraction.static_profile_json.interests || []
      ),
      skills: this.mergeArrays(existingSkills, newExtraction.static_profile_json.skills || []),
      profession:
        newExtraction.static_profile_json.profession ||
        (typeof existingStatic.profession === 'string' ? existingStatic.profession : undefined),
      demographics: {
        ...existingDemographics,
        ...newExtraction.static_profile_json.demographics,
      },
      long_term_patterns: this.mergeArrays(
        existingLongTermPatterns,
        newExtraction.static_profile_json.long_term_patterns || []
      ),
      domains: this.mergeArrays(existingDomains, newExtraction.static_profile_json.domains || []),
      expertise_areas: this.mergeArrays(
        existingExpertiseAreas,
        newExtraction.static_profile_json.expertise_areas || []
      ),
      personality_traits: this.mergeArrays(
        existingPersonalityTraits,
        newExtraction.static_profile_json.personality_traits || []
      ),
      work_style: {
        ...(existingStatic.work_style &&
        typeof existingStatic.work_style === 'object' &&
        existingStatic.work_style !== null &&
        !Array.isArray(existingStatic.work_style)
          ? (existingStatic.work_style as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.work_style,
      },
      communication_style: {
        ...(existingStatic.communication_style &&
        typeof existingStatic.communication_style === 'object' &&
        existingStatic.communication_style !== null &&
        !Array.isArray(existingStatic.communication_style)
          ? (existingStatic.communication_style as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.communication_style,
      },
      learning_preferences: {
        ...(existingStatic.learning_preferences &&
        typeof existingStatic.learning_preferences === 'object' &&
        existingStatic.learning_preferences !== null &&
        !Array.isArray(existingStatic.learning_preferences)
          ? (existingStatic.learning_preferences as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.learning_preferences,
      },
      values_and_priorities: this.mergeArrays(
        existingValuesAndPriorities,
        newExtraction.static_profile_json.values_and_priorities || []
      ),
      technology_preferences: {
        ...(existingStatic.technology_preferences &&
        typeof existingStatic.technology_preferences === 'object' &&
        existingStatic.technology_preferences !== null &&
        !Array.isArray(existingStatic.technology_preferences)
          ? (existingStatic.technology_preferences as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.technology_preferences,
      },
      lifestyle_patterns: {
        ...(existingStatic.lifestyle_patterns &&
        typeof existingStatic.lifestyle_patterns === 'object' &&
        existingStatic.lifestyle_patterns !== null &&
        !Array.isArray(existingStatic.lifestyle_patterns)
          ? (existingStatic.lifestyle_patterns as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.lifestyle_patterns,
      },
      cognitive_style: {
        ...(existingStatic.cognitive_style &&
        typeof existingStatic.cognitive_style === 'object' &&
        existingStatic.cognitive_style !== null &&
        !Array.isArray(existingStatic.cognitive_style)
          ? (existingStatic.cognitive_style as Record<string, unknown>)
          : {}),
        ...newExtraction.static_profile_json.cognitive_style,
      },
    }

    const existingCurrentProjects = Array.isArray(existingDynamic.current_projects)
      ? (existingDynamic.current_projects as string[])
      : []
    const existingRecentChanges = Array.isArray(existingDynamic.recent_changes)
      ? (existingDynamic.recent_changes as string[])
      : []
    const existingActiveGoals = Array.isArray(existingDynamic.active_goals)
      ? (existingDynamic.active_goals as string[])
      : []
    const existingRecentAchievements = Array.isArray(existingDynamic.recent_achievements)
      ? (existingDynamic.recent_achievements as string[])
      : []
    const existingEmotionalState =
      existingDynamic.emotional_state &&
      typeof existingDynamic.emotional_state === 'object' &&
      existingDynamic.emotional_state !== null &&
      !Array.isArray(existingDynamic.emotional_state)
        ? (existingDynamic.emotional_state as Record<string, unknown>)
        : {}

    const mergedDynamic = {
      recent_activities: newExtraction.dynamic_profile_json.recent_activities || [],
      current_projects: this.mergeArrays(
        existingCurrentProjects,
        newExtraction.dynamic_profile_json.current_projects || []
      ),
      temporary_interests: newExtraction.dynamic_profile_json.temporary_interests || [],
      recent_changes: this.mergeArrays(
        existingRecentChanges,
        newExtraction.dynamic_profile_json.recent_changes || []
      ),
      current_context: newExtraction.dynamic_profile_json.current_context || [],
      active_goals: this.mergeArrays(
        existingActiveGoals,
        newExtraction.dynamic_profile_json.active_goals || []
      ),
      current_challenges: newExtraction.dynamic_profile_json.current_challenges || [],
      recent_achievements: this.mergeArrays(
        existingRecentAchievements,
        newExtraction.dynamic_profile_json.recent_achievements || []
      ),
      current_focus_areas: newExtraction.dynamic_profile_json.current_focus_areas || [],
      emotional_state: {
        ...existingEmotionalState,
        ...newExtraction.dynamic_profile_json.emotional_state,
      },
      active_research_topics: newExtraction.dynamic_profile_json.active_research_topics || [],
      upcoming_events: newExtraction.dynamic_profile_json.upcoming_events || [],
    }

    return {
      static_profile_json: mergedStatic,
      static_profile_text: newExtraction.static_profile_text || existing.static_profile_text || '',
      dynamic_profile_json: mergedDynamic,
      dynamic_profile_text:
        newExtraction.dynamic_profile_text || existing.dynamic_profile_text || '',
    }
  }

  private mergeArrays(existing: string[], newItems: string[]): string[] {
    const merged = new Set([...existing, ...newItems])
    return Array.from(merged).slice(0, 20)
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const cacheKey = getProfileCacheKey(userId)
      const client = getRedisClient()
      const cached = await client.get(cacheKey)

      if (cached) {
        return JSON.parse(cached) as UserProfile
      }
    } catch (error) {
      logger.warn('[profile] cache read error, continuing without cache', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const profile = await prisma.userProfile.findUnique({
      where: { user_id: userId },
    })

    if (profile) {
      try {
        const cacheKey = getProfileCacheKey(userId)
        const client = getRedisClient()
        await client.setex(cacheKey, PROFILE_CACHE_TTL, JSON.stringify(profile))
      } catch (error) {
        logger.warn('[profile] cache write error', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return profile as UserProfile | null
  }

  async getProfileContext(userId: string): Promise<string> {
    try {
      const cacheKey = getProfileContextCacheKey(userId)
      const client = getRedisClient()
      const cached = await client.get(cacheKey)

      if (cached) {
        return cached
      }
    } catch (error) {
      logger.warn('[profile] context cache read error, continuing without cache', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const profile = await this.getUserProfile(userId)

    if (!profile) {
      return ''
    }

    const staticText = profile.static_profile_text || ''
    const dynamicText = profile.dynamic_profile_text || ''

    if (!staticText && !dynamicText) {
      return ''
    }

    const parts: string[] = []

    // Start with comprehensive profile description
    if (staticText) {
      parts.push(`=== COMPLETE USER PROFILE ===\n${staticText}`)
    }

    // Add personal narrative prominently
    const staticJson = profile.static_profile_json as Record<string, unknown> | null
    const personalNarrative = staticJson?.personal_narrative as
      | {
          who?: string
          why?: string
          what?: string
          how?: string
        }
      | undefined

    if (personalNarrative) {
      const narrativeParts: string[] = []
      if (personalNarrative.who) {
        narrativeParts.push(`WHO:\n${personalNarrative.who}`)
      }
      if (personalNarrative.why) {
        narrativeParts.push(`WHY:\n${personalNarrative.why}`)
      }
      if (personalNarrative.what) {
        narrativeParts.push(`WHAT:\n${personalNarrative.what}`)
      }
      if (personalNarrative.how) {
        narrativeParts.push(`HOW:\n${personalNarrative.how}`)
      }
      if (narrativeParts.length > 0) {
        parts.push(`\n=== PERSONAL NARRATIVE ===\n${narrativeParts.join('\n\n')}`)
      }
    }

    // Extract and prominently display ALL user preferences
    if (staticJson) {
      const preferencesParts: string[] = []

      // Work Style Preferences
      const workStyle = staticJson.work_style as Record<string, unknown> | undefined
      if (workStyle && Object.keys(workStyle).length > 0) {
        const workStyleDetails: string[] = []
        if (workStyle.preferred_work_hours) {
          workStyleDetails.push(`Preferred Work Hours: ${workStyle.preferred_work_hours}`)
        }
        if (workStyle.collaboration_style) {
          workStyleDetails.push(`Collaboration Style: ${workStyle.collaboration_style}`)
        }
        if (workStyle.decision_making_style) {
          workStyleDetails.push(`Decision Making Style: ${workStyle.decision_making_style}`)
        }
        if (workStyle.problem_solving_approach) {
          workStyleDetails.push(`Problem Solving Approach: ${workStyle.problem_solving_approach}`)
        }
        if (workStyleDetails.length > 0) {
          preferencesParts.push(`WORK STYLE PREFERENCES:\n${workStyleDetails.join('\n')}`)
        }
      }

      // Communication Preferences
      const communicationStyle = staticJson.communication_style as
        | Record<string, unknown>
        | undefined
      if (communicationStyle && Object.keys(communicationStyle).length > 0) {
        const commDetails: string[] = []
        if (
          Array.isArray(communicationStyle.preferred_channels) &&
          communicationStyle.preferred_channels.length > 0
        ) {
          commDetails.push(
            `Preferred Channels: ${(communicationStyle.preferred_channels as string[]).join(', ')}`
          )
        }
        if (communicationStyle.communication_frequency) {
          commDetails.push(`Communication Frequency: ${communicationStyle.communication_frequency}`)
        }
        if (communicationStyle.tone_preference) {
          commDetails.push(`Tone Preference: ${communicationStyle.tone_preference}`)
        }
        if (commDetails.length > 0) {
          preferencesParts.push(`COMMUNICATION PREFERENCES:\n${commDetails.join('\n')}`)
        }
      }

      // Learning Preferences
      const learningPreferences = staticJson.learning_preferences as
        | Record<string, unknown>
        | undefined
      if (learningPreferences && Object.keys(learningPreferences).length > 0) {
        const learningDetails: string[] = []
        if (
          Array.isArray(learningPreferences.preferred_learning_methods) &&
          learningPreferences.preferred_learning_methods.length > 0
        ) {
          learningDetails.push(
            `Preferred Learning Methods: ${(learningPreferences.preferred_learning_methods as string[]).join(', ')}`
          )
        }
        if (learningPreferences.learning_pace) {
          learningDetails.push(`Learning Pace: ${learningPreferences.learning_pace}`)
        }
        if (learningPreferences.knowledge_retention_style) {
          learningDetails.push(
            `Knowledge Retention Style: ${learningPreferences.knowledge_retention_style}`
          )
        }
        if (learningDetails.length > 0) {
          preferencesParts.push(`LEARNING PREFERENCES:\n${learningDetails.join('\n')}`)
        }
      }

      // Technology Preferences
      const techPreferences = staticJson.technology_preferences as
        | Record<string, unknown>
        | undefined
      if (techPreferences && Object.keys(techPreferences).length > 0) {
        const techDetails: string[] = []
        if (
          Array.isArray(techPreferences.preferred_tools) &&
          techPreferences.preferred_tools.length > 0
        ) {
          techDetails.push(
            `Preferred Tools: ${(techPreferences.preferred_tools as string[]).join(', ')}`
          )
        }
        if (techPreferences.tech_comfort_level) {
          techDetails.push(`Tech Comfort Level: ${techPreferences.tech_comfort_level}`)
        }
        if (
          Array.isArray(techPreferences.preferred_platforms) &&
          techPreferences.preferred_platforms.length > 0
        ) {
          techDetails.push(
            `Preferred Platforms: ${(techPreferences.preferred_platforms as string[]).join(', ')}`
          )
        }
        if (techDetails.length > 0) {
          preferencesParts.push(`TECHNOLOGY PREFERENCES:\n${techDetails.join('\n')}`)
        }
      }

      // Cognitive Style Preferences
      const cognitiveStyle = staticJson.cognitive_style as Record<string, unknown> | undefined
      if (cognitiveStyle && Object.keys(cognitiveStyle).length > 0) {
        const cognitiveDetails: string[] = []
        if (cognitiveStyle.thinking_pattern) {
          cognitiveDetails.push(`Thinking Pattern: ${cognitiveStyle.thinking_pattern}`)
        }
        if (cognitiveStyle.information_processing) {
          cognitiveDetails.push(`Information Processing: ${cognitiveStyle.information_processing}`)
        }
        if (cognitiveStyle.creativity_level) {
          cognitiveDetails.push(`Creativity Level: ${cognitiveStyle.creativity_level}`)
        }
        if (cognitiveDetails.length > 0) {
          preferencesParts.push(`COGNITIVE STYLE PREFERENCES:\n${cognitiveDetails.join('\n')}`)
        }
      }

      // Lifestyle Preferences
      const lifestylePatterns = staticJson.lifestyle_patterns as Record<string, unknown> | undefined
      if (lifestylePatterns && Object.keys(lifestylePatterns).length > 0) {
        const lifestyleDetails: string[] = []
        if (lifestylePatterns.activity_level) {
          lifestyleDetails.push(`Activity Level: ${lifestylePatterns.activity_level}`)
        }
        if (lifestylePatterns.social_patterns) {
          lifestyleDetails.push(`Social Patterns: ${lifestylePatterns.social_patterns}`)
        }
        if (lifestylePatterns.productivity_patterns) {
          lifestyleDetails.push(`Productivity Patterns: ${lifestylePatterns.productivity_patterns}`)
        }
        if (lifestyleDetails.length > 0) {
          preferencesParts.push(`LIFESTYLE PREFERENCES:\n${lifestyleDetails.join('\n')}`)
        }
      }

      // Values and Priorities
      if (
        Array.isArray(staticJson.values_and_priorities) &&
        staticJson.values_and_priorities.length > 0
      ) {
        preferencesParts.push(
          `VALUES AND PRIORITIES:\n${(staticJson.values_and_priorities as string[]).join(', ')}`
        )
      }

      // Interests
      if (Array.isArray(staticJson.interests) && staticJson.interests.length > 0) {
        preferencesParts.push(`INTERESTS:\n${(staticJson.interests as string[]).join(', ')}`)
      }

      // Skills
      if (Array.isArray(staticJson.skills) && staticJson.skills.length > 0) {
        preferencesParts.push(`SKILLS:\n${(staticJson.skills as string[]).join(', ')}`)
      }

      // Profession
      if (staticJson.profession) {
        preferencesParts.push(`PROFESSION:\n${staticJson.profession}`)
      }

      // Personality Traits
      if (
        Array.isArray(staticJson.personality_traits) &&
        staticJson.personality_traits.length > 0
      ) {
        preferencesParts.push(
          `PERSONALITY TRAITS:\n${(staticJson.personality_traits as string[]).join(', ')}`
        )
      }

      // Add preferences section prominently
      if (preferencesParts.length > 0) {
        parts.push(
          `\n=== USER PREFERENCES (IMPORTANT - USE THESE WHEN RESPONDING) ===\n${preferencesParts.join('\n\n')}`
        )
      }
    }

    // Add current dynamic context
    if (dynamicText) {
      parts.push(`\n=== CURRENT CONTEXT AND STATE ===\n${dynamicText}`)
    }

    // Add dynamic profile details
    const dynamicJson = profile.dynamic_profile_json as Record<string, unknown> | null
    if (dynamicJson) {
      const dynamicParts: string[] = []

      if (Array.isArray(dynamicJson.current_projects) && dynamicJson.current_projects.length > 0) {
        dynamicParts.push(
          `Current Projects: ${(dynamicJson.current_projects as string[]).join(', ')}`
        )
      }

      if (Array.isArray(dynamicJson.active_goals) && dynamicJson.active_goals.length > 0) {
        dynamicParts.push(`Active Goals: ${(dynamicJson.active_goals as string[]).join(', ')}`)
      }

      if (
        Array.isArray(dynamicJson.current_focus_areas) &&
        dynamicJson.current_focus_areas.length > 0
      ) {
        dynamicParts.push(
          `Current Focus Areas: ${(dynamicJson.current_focus_areas as string[]).join(', ')}`
        )
      }

      if (
        Array.isArray(dynamicJson.active_research_topics) &&
        dynamicJson.active_research_topics.length > 0
      ) {
        dynamicParts.push(
          `Active Research Topics: ${(dynamicJson.active_research_topics as string[]).join(', ')}`
        )
      }

      if (dynamicParts.length > 0) {
        parts.push(`\n=== CURRENT ACTIVITIES ===\n${dynamicParts.join('\n')}`)
      }
    }

    const context = parts.join('\n\n')

    try {
      const cacheKey = getProfileContextCacheKey(userId)
      const client = getRedisClient()
      await client.setex(cacheKey, PROFILE_CONTEXT_CACHE_TTL, context)
    } catch (error) {
      logger.warn('[profile] context cache write error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return context
  }

  async shouldUpdateProfile(userId: string, daysSinceLastUpdate: number = 7): Promise<boolean> {
    const profile = await this.getUserProfile(userId)

    if (!profile) {
      return true
    }

    const lastUpdated =
      profile.last_updated instanceof Date ? profile.last_updated : new Date(profile.last_updated)
    const daysSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince >= daysSinceLastUpdate
  }

  async getUsersNeedingUpdate(daysSinceLastUpdate: number = 7): Promise<string[]> {
    const cutoffDate = new Date(Date.now() - daysSinceLastUpdate * 24 * 60 * 60 * 1000)

    const allUsers = await prisma.user.findMany({
      select: { id: true },
    })

    const usersNeedingUpdate: string[] = []

    for (const user of allUsers) {
      const profile = await prisma.userProfile.findUnique({
        where: { user_id: user.id },
        select: { last_updated: true },
      })

      if (!profile) {
        usersNeedingUpdate.push(user.id)
        continue
      }

      const lastUpdated =
        profile.last_updated instanceof Date ? profile.last_updated : new Date(profile.last_updated)

      if (lastUpdated < cutoffDate) {
        usersNeedingUpdate.push(user.id)
      }
    }

    return usersNeedingUpdate
  }

  async getUsersNeedingUpdateByHours(hoursSinceLastUpdate: number): Promise<string[]> {
    const cutoffDate = new Date(Date.now() - hoursSinceLastUpdate * 60 * 60 * 1000)

    const allUsers = await prisma.user.findMany({
      select: { id: true },
    })

    const usersNeedingUpdate: string[] = []

    for (const user of allUsers) {
      const profile = await prisma.userProfile.findUnique({
        where: { user_id: user.id },
        select: { last_updated: true },
      })

      if (!profile) {
        usersNeedingUpdate.push(user.id)
        continue
      }

      const lastUpdated =
        profile.last_updated instanceof Date ? profile.last_updated : new Date(profile.last_updated)

      if (lastUpdated < cutoffDate) {
        usersNeedingUpdate.push(user.id)
      }
    }

    return usersNeedingUpdate
  }
}

export const profileUpdateService = new ProfileUpdateService()
