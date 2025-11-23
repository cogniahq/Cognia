import { aiProvider } from './ai-provider.service'
import { logger } from '../utils/logger.util'
import { Prisma } from '@prisma/client'

export interface StaticProfile {
  interests: string[]
  skills: string[]
  profession?: string
  demographics?: {
    age_range?: string
    location?: string
    education?: string
  }
  long_term_patterns: string[]
  domains: string[]
  expertise_areas: string[]
  personality_traits?: string[]
  work_style?: {
    preferred_work_hours?: string
    collaboration_style?: string
    decision_making_style?: string
    problem_solving_approach?: string
  }
  communication_style?: {
    preferred_channels?: string[]
    communication_frequency?: string
    tone_preference?: string
  }
  learning_preferences?: {
    preferred_learning_methods?: string[]
    learning_pace?: string
    knowledge_retention_style?: string
  }
  values_and_priorities?: string[]
  technology_preferences?: {
    preferred_tools?: string[]
    tech_comfort_level?: string
    preferred_platforms?: string[]
  }
  lifestyle_patterns?: {
    activity_level?: string
    social_patterns?: string
    productivity_patterns?: string
  }
  cognitive_style?: {
    thinking_pattern?: string
    information_processing?: string
    creativity_level?: string
  }
  personal_narrative?: {
    who?: string
    why?: string
    what?: string
    how?: string
  }
}

export interface DynamicProfile {
  recent_activities: string[]
  current_projects: string[]
  temporary_interests: string[]
  recent_changes: string[]
  current_context: string[]
  active_goals?: string[]
  current_challenges?: string[]
  recent_achievements?: string[]
  current_focus_areas?: string[]
  emotional_state?: {
    current_concerns?: string[]
    current_excitements?: string[]
    stress_level?: string
  }
  active_research_topics?: string[]
  upcoming_events?: string[]
}

export interface ProfileExtractionResult {
  static_profile_json: StaticProfile
  static_profile_text: string
  dynamic_profile_json: DynamicProfile
  dynamic_profile_text: string
  isFallback?: boolean
}

export class ProfileExtractionService {
  async extractProfileFromMemories(
    userId: string,
    memories: Array<{
      id: string
      title: string | null
      content_preview?: string | null
      content: string
      created_at: Date
      page_metadata: Prisma.JsonValue
    }>,
    existingProfile?: {
      static_profile_json?: unknown
      static_profile_text?: string | null
      dynamic_profile_json?: unknown
      dynamic_profile_text?: string | null
    } | null
  ): Promise<ProfileExtractionResult> {
    if (memories.length === 0) {
      return this.getEmptyProfile()
    }

    const memoryContext = this.prepareMemoryContext(memories, existingProfile)
    const prompt = this.buildExtractionPrompt(memoryContext, existingProfile)

    try {
      const response = await aiProvider.generateContent(prompt, false, userId)
      const parsed = this.parseProfileResponse(response)
      return { ...parsed, isFallback: false }
    } catch (error) {
      logger.error('Error extracting profile from memories, retrying once:', error)

      try {
        const retryResponse = await aiProvider.generateContent(prompt, false, userId)
        const retryParsed = this.parseProfileResponse(retryResponse)
        logger.log('Profile extraction succeeded on retry')
        return { ...retryParsed, isFallback: false }
      } catch (retryError) {
        logger.error('Error extracting profile from memories on retry, using fallback:', {
          error: retryError instanceof Error ? retryError.message : String(retryError),
          stack: retryError instanceof Error ? retryError.stack : undefined,
        })
        const fallbackResult = this.extractProfileFallback(memories)
        logger.log('Using fallback profile extraction', {
          hasStatic: !!fallbackResult.static_profile_json,
          hasDynamic: !!fallbackResult.dynamic_profile_json,
        })
        return { ...fallbackResult, isFallback: true }
      }
    }
  }

  private prepareMemoryContext(
    memories: Array<{
      id: string
      title: string | null
      content_preview?: string | null
      content: string
      created_at: Date
      page_metadata: Prisma.JsonValue
    }>,
    existingProfile?: {
      static_profile_json?: unknown
      static_profile_text?: string | null
      dynamic_profile_json?: unknown
      dynamic_profile_text?: string | null
    } | null
  ): string {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const allMemories = memories
      .map((m, idx) => {
        const metadata = m.page_metadata as Record<string, unknown> | null
        const daysAgo = Math.floor((now.getTime() - m.created_at.getTime()) / (1000 * 60 * 60 * 24))
        const isRecent = m.created_at >= thirtyDaysAgo
        const isVeryRecent = m.created_at >= sevenDaysAgo

        const topics = Array.isArray(metadata?.topics)
          ? metadata.topics.filter((t): t is string => typeof t === 'string').join(', ')
          : 'N/A'
        const categories = Array.isArray(metadata?.categories)
          ? metadata.categories.filter((c): c is string => typeof c === 'string').join(', ')
          : 'N/A'

        // Include more content for recent memories, full content for very recent ones
        // If updating existing profile, include more content to capture new information
        const isUpdate = !!existingProfile
        let content: string
        if (isVeryRecent) {
          // Include full content for very recent memories (last 7 days)
          content = m.content || m.content_preview || ''
        } else if (isRecent) {
          // Include up to 1500 characters for recent memories if updating, 1000 if initial
          const fullContent = m.content || m.content_preview || ''
          const maxLength = isUpdate ? 1500 : 1000
          content =
            fullContent.length > maxLength
              ? fullContent.substring(0, maxLength) + '...'
              : fullContent
        } else {
          // Include up to 800 characters for older memories if updating, 500 if initial
          const fullContent = m.content || m.content_preview || ''
          const maxLength = isUpdate ? 800 : 500
          content =
            fullContent.length > maxLength
              ? fullContent.substring(0, maxLength) + '...'
              : fullContent
        }

        return `Memory ${idx + 1} (${daysAgo} days ago${isRecent ? ', RECENT' : ''}${isVeryRecent ? ', VERY RECENT' : ''}):
Title: ${m.title || 'Untitled'}
Topics: ${topics}
Categories: ${categories}
Content: ${content}`
      })
      .join('\n\n')

    const recentCount = memories.filter(m => m.created_at >= thirtyDaysAgo).length
    const veryRecentCount = memories.filter(m => m.created_at >= sevenDaysAgo).length
    const totalCount = memories.length

    let contextHeader = `Total memories analyzed: ${totalCount}
Recent memories (last 30 days): ${recentCount}
Very recent memories (last 7 days): ${veryRecentCount}`

    if (existingProfile) {
      contextHeader += `\n\nEXISTING PROFILE CONTEXT:
The user already has a profile. Focus on:
1. UPDATING and ENRICHING existing information with new details
2. IDENTIFYING NEW information not yet captured in the profile
3. REFINING and making more specific any generic or incomplete information
4. UPDATING dynamic information (current state, goals, challenges, etc.)
5. ADDING new preferences, traits, or characteristics discovered in these memories

The profile should be COMPREHENSIVE - include everything about the user, not just what's new.`
    } else {
      contextHeader += `\n\nINITIAL PROFILE EXTRACTION:
This is the first time building a profile for this user. Extract EVERYTHING comprehensively:
- Complete personality, preferences, behaviors, values, goals
- Work style, communication style, learning preferences
- Technology preferences, cognitive style, lifestyle patterns
- Interests, skills, expertise, motivations, unique characteristics
- Build a complete, detailed profile that tells the full story of who they are.`
    }

    contextHeader += `\n\nIMPORTANT: Analyze ALL memories comprehensively to extract EVERYTHING about this user. Go deep into the content to understand the full picture of who they are. Be specific, personal, and comprehensive.`

    return `${contextHeader}

Memories:
${allMemories}`
  }

  private buildExtractionPrompt(
    memoryContext: string,
    existingProfile?: {
      static_profile_json?: unknown
      static_profile_text?: string | null
      dynamic_profile_json?: unknown
      dynamic_profile_text?: string | null
    } | null
  ): string {
    let profileContextNote = ''
    if (existingProfile) {
      const existingStaticText = existingProfile.static_profile_text || ''
      const existingDynamicText = existingProfile.dynamic_profile_text || ''
      profileContextNote = `\n\nEXISTING PROFILE INFORMATION (for reference - build upon and enhance this):
${existingStaticText ? `Static Profile: ${existingStaticText.substring(0, 500)}...` : ''}
${existingDynamicText ? `Dynamic Profile: ${existingDynamicText.substring(0, 300)}...` : ''}

IMPORTANT: Use the existing profile as a foundation, but:
- ENRICH it with new details from the memories
- ADD new information not yet captured
- REFINE generic statements to be more specific
- UPDATE dynamic information (current state, goals, etc.)
- Make it MORE comprehensive, not less`
    }

    return `You are Cognia profile extraction system. Your task is to deeply understand EVERYTHING about this user - their complete identity, personality, preferences, behaviors, motivations, and unique characteristics. Create a comprehensive, deeply personalized profile that tells the complete story of who they are as a person.${profileContextNote}

CRITICAL: Return ONLY valid JSON. No explanations, no markdown formatting, no code blocks, no special characters. Just the JSON object.

IMPORTANT JSON RULES:
- All strings must be properly escaped (use \\" for quotes inside strings, \\n for newlines)
- No trailing commas
- All property names must be in double quotes
- All string values must be in double quotes
- Escape all special characters in strings (quotes, newlines, backslashes)
- Do not include any text before or after the JSON object
- The JSON must be valid and parseable

Return a JSON object with this exact structure:
{
  "static_profile_json": {
    "interests": ["long-term interests and passions - be comprehensive and specific"],
    "skills": ["skills, expertise, and competencies - include both technical and soft skills"],
    "profession": "profession, field, or career path - be specific",
    "demographics": {
      "age_range": "age range if evident",
      "location": "location if evident",
      "education": "education level if evident"
    },
    "long_term_patterns": ["persistent behavioral patterns, habits, or tendencies - what do they consistently do?"],
    "domains": ["knowledge domains and areas of focus - be comprehensive"],
    "expertise_areas": ["areas of deep expertise - what are they really good at?"],
    "personality_traits": ["personality characteristics inferred from behavior and content - be specific and detailed"],
    "work_style": {
      "preferred_work_hours": "when they seem most active or productive - be specific",
      "collaboration_style": "how they work with others (independent, collaborative, etc.) - detailed description",
      "decision_making_style": "how they make decisions (analytical, intuitive, etc.) - be specific",
      "problem_solving_approach": "how they approach problems (systematic, creative, etc.) - detailed"
    },
    "communication_style": {
      "preferred_channels": ["communication methods they use - be comprehensive"],
      "communication_frequency": "how often they communicate - be specific",
      "tone_preference": "formal, casual, technical, etc. - detailed description"
    },
    "learning_preferences": {
      "preferred_learning_methods": ["how they learn (reading, videos, hands-on, etc.) - be comprehensive"],
      "learning_pace": "fast, methodical, deep-dive, etc. - be specific",
      "knowledge_retention_style": "how they retain information - detailed description"
    },
    "values_and_priorities": ["core values and what matters to them - be comprehensive and specific"],
    "technology_preferences": {
      "preferred_tools": ["tools, platforms, or technologies they use - be comprehensive"],
      "tech_comfort_level": "early adopter, mainstream, cautious, etc. - be specific",
      "preferred_platforms": ["platforms they prefer - be comprehensive"]
    },
    "lifestyle_patterns": {
      "activity_level": "active, balanced, focused, etc. - be specific",
      "social_patterns": "social preferences and patterns - detailed description",
      "productivity_patterns": "how they organize and manage productivity - be comprehensive"
    },
    "cognitive_style": {
      "thinking_pattern": "analytical, creative, practical, strategic, etc. - be specific and detailed",
      "information_processing": "how they process information (detail-oriented, big-picture, etc.) - detailed",
      "creativity_level": "highly creative, methodical, balanced, etc. - be specific"
    },
    "personal_narrative": {
      "who": "A comprehensive, detailed description (400-800 words) of WHO this person is - their complete identity, role, background, core characteristics, personality essence, values, beliefs, quirks, strengths, weaknesses, and what makes them uniquely them. This should tell the complete story of their identity. Include: their professional identity, personal identity, how they see themselves, how others might see them, their core traits, their background, their current life stage, their relationships with work, learning, technology, and life. Be deeply personal, specific, and comprehensive. Write as if you're describing someone you know intimately.",
      "why": "A comprehensive, detailed explanation (300-600 words) of WHY they do what they do - their complete motivations, driving forces, goals (both explicit and implicit), values, reasons for actions, what inspires them, what they're passionate about, what they're trying to achieve, what they care about most, their deeper purpose, their aspirations, their fears, their hopes. This should explain their complete motivational landscape. Be deeply personal and specific.",
      "what": "A comprehensive, detailed description (300-600 words) of WHAT they do, focus on, and engage with - their complete range of interests, activities, projects, areas of focus, work, hobbies, learning pursuits, and what occupies their attention. Cover both long-term and current activities. Include: their work, their projects, their interests, their hobbies, their learning pursuits, what they research, what they create, what they consume, what they engage with. Be comprehensive and specific.",
      "how": "A comprehensive, detailed explanation (300-600 words) of HOW they approach things - their complete methods, styles, approaches, preferences, ways of working, learning, thinking, creating, problem-solving, decision-making, communicating, and engaging with the world. Include: their work methodology, their learning approach, their problem-solving style, their decision-making process, their communication approach, their creative process, their research methods, their tool usage patterns, their workflow preferences. Be detailed and specific."
    }
  },
  "static_profile_text": "A rich, comprehensive, detailed natural language description (600-1000 words) that tells EVERYTHING about this user. This should be a complete portrait of who they are. Include: their complete personality profile, their work style in detail, their communication style, their learning preferences, their values and priorities, their thinking patterns, their cognitive style, their technology preferences, their lifestyle patterns, their interests and passions, their skills and expertise, their profession and career, their background, their motivations, their goals, their preferences across all domains, and what makes them uniquely them. Write as if you're writing a comprehensive biography of someone you know intimately - be specific, personal, insightful, and comprehensive. Cover every aspect of their identity, preferences, and characteristics. This should be the definitive description of this person.",
  "dynamic_profile_json": {
    "recent_activities": ["recent activities and behaviors - be comprehensive"],
    "current_projects": ["active projects or initiatives - be detailed"],
    "temporary_interests": ["temporary or emerging interests - be specific"],
    "recent_changes": ["recent life or work changes - be detailed"],
    "current_context": ["current situational context - be comprehensive"],
    "active_goals": ["goals they're actively pursuing - be specific"],
    "current_challenges": ["challenges they're facing - be detailed"],
    "recent_achievements": ["recent accomplishments or milestones - be specific"],
    "current_focus_areas": ["what they're currently focusing on - be comprehensive"],
    "emotional_state": {
      "current_concerns": ["current worries or concerns - be specific"],
      "current_excitements": ["what they're excited about - be detailed"],
      "stress_level": "high, medium, low, or inferred level - be specific"
    },
    "active_research_topics": ["topics they're actively researching - be comprehensive"],
    "upcoming_events": ["upcoming events or deadlines - be specific"]
  },
  "dynamic_profile_text": "A detailed, comprehensive natural language description (400-700 words) of their current state, recent changes, active goals, challenges, emotional state, and what's happening in their life right now. This should paint a complete picture of where they are in their journey. Include: their current activities, their active projects, their current goals, their current challenges, their recent achievements, their current focus areas, their emotional state, their current concerns and excitements, their active research, their upcoming events, recent changes in their life, and how all of this relates to their overall profile. Be specific, personal, and comprehensive. This should tell the complete story of their current moment."
}

Deep Analysis Guidelines - Be COMPREHENSIVE:
- Go DEEP beyond surface-level facts - understand their complete personality, motivations, and unique characteristics
- Extract EVERYTHING you can learn about them - their preferences, behaviors, patterns, values, goals, fears, hopes
- Infer work style from when and how they engage with content - be specific about timing, patterns, intensity
- Understand their thinking patterns from the types of content they consume - what does this reveal about how they think?
- Identify their values from what they prioritize and focus on - what truly matters to them?
- Recognize their communication style from the language and topics they engage with - how do they express themselves?
- Understand their learning preferences from how they consume information - how do they learn best?
- Identify ALL patterns in their behavior, interests, and focus areas - what patterns emerge?
- Be EXTREMELY specific and personal - avoid ANY generic statements
- Only include information that can be reasonably inferred from the memories, but be comprehensive in what you infer
- For personality traits: Are they analytical? Creative? Methodical? Spontaneous? Detail-oriented? Big-picture? Introverted? Extroverted? Practical? Theoretical? Optimistic? Pessimistic? Risk-taking? Cautious? Be comprehensive.
- For work style: When do they work? How do they approach tasks? Do they prefer structure or flexibility? How do they handle deadlines? How do they collaborate? Be detailed.
- For values: What do they prioritize? What matters to them? What drives their decisions? What are they willing to sacrifice? What are they not willing to compromise on? Be comprehensive.
- For preferences: What do they prefer in tools? In communication? In learning? In work? In life? Be comprehensive across all domains.
- Think about their complete identity - professional, personal, intellectual, emotional, social, creative, practical
- Consider their complete journey - where they've been, where they are, where they're going
- Think about their complete context - their environment, their relationships, their constraints, their opportunities

CRITICAL: The personal_narrative section (WHO, WHY, WHAT, HOW) is ESSENTIAL. Make it:
- EXTREMELY comprehensive - tell the complete story of who they are
- Deeply personal and specific to this individual - no generic statements
- Rich in detail that helps understand their unique perspective - include specific examples and patterns
- Written in a way that helps connect new memories to their identity - make it actionable
- Comprehensive enough to provide complete context for why certain memories matter to them
- Focused on making the user completely relatable and understandable as a unique person
- Long enough to tell the complete story - don't be brief, be comprehensive

CRITICAL: The static_profile_text should be a COMPLETE portrait. It should:
- Tell EVERYTHING about the user - be comprehensive
- Include ALL their preferences across all domains
- Be detailed enough that someone reading it would feel they know this person
- Cover personality, work style, communication, learning, values, thinking, technology, lifestyle, interests, skills, profession, background, motivations, goals
- Be specific and personal - no generic statements
- Be long enough to be comprehensive (600-1000 words)

CRITICAL: The dynamic_profile_text should paint a COMPLETE picture of their current state:
- Include everything about where they are right now
- Connect current state to their overall profile
- Be comprehensive about their current activities, goals, challenges, emotional state
- Be specific and personal
- Be long enough to be comprehensive (400-700 words)

Memory Context:
${memoryContext}

Return ONLY the JSON object:`
  }

  private parseProfileResponse(response: string): ProfileExtractionResult {
    let jsonStr = this.extractJsonString(response)

    if (!jsonStr) {
      throw new Error('No JSON found in response')
    }

    let data

    try {
      data = JSON.parse(jsonStr)
    } catch {
      try {
        jsonStr = this.fixJson(jsonStr)
        data = JSON.parse(jsonStr)
      } catch {
        try {
          jsonStr = this.fixJsonAdvanced(jsonStr)
          data = JSON.parse(jsonStr)
        } catch (thirdError) {
          logger.error('Error parsing profile response after fixes:', thirdError)
          logger.error('JSON string (first 1000 chars):', jsonStr.substring(0, 1000))
          logger.error(
            'JSON string (last 500 chars):',
            jsonStr.substring(Math.max(0, jsonStr.length - 500))
          )
          throw new Error('Failed to parse JSON after fixes')
        }
      }
    }

    if (!data.static_profile_json || !data.dynamic_profile_json) {
      logger.warn('Invalid profile structure: missing required fields', {
        hasStatic: !!data.static_profile_json,
        hasDynamic: !!data.dynamic_profile_json,
        dataKeys: Object.keys(data),
      })
      throw new Error('Invalid profile structure: missing required fields')
    }

    return {
      static_profile_json: data.static_profile_json,
      static_profile_text: data.static_profile_text || '',
      dynamic_profile_json: data.dynamic_profile_json,
      dynamic_profile_text: data.dynamic_profile_text || '',
    }
  }

  private extractJsonString(response: string): string | null {
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1]
    }

    const firstBrace = response.indexOf('{')
    if (firstBrace === -1) {
      return null
    }

    let braceCount = 0
    let inString = false
    let escapeNext = false
    let lastValidBrace = -1

    for (let i = firstBrace; i < response.length; i++) {
      const char = response[i]

      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        continue
      }

      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }

      if (inString) {
        continue
      }

      if (char === '{') {
        braceCount++
        lastValidBrace = i
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          return response.substring(firstBrace, i + 1)
        }
        lastValidBrace = i
      }
    }

    if (lastValidBrace > firstBrace) {
      return response.substring(firstBrace, lastValidBrace + 1)
    }

    return null
  }

  private fixJson(jsonStr: string): string {
    let fixed = jsonStr

    fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    const textFields = ['static_profile_text', 'dynamic_profile_text']
    for (const field of textFields) {
      const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 'g')
      fixed = fixed.replace(regex, (match, value) => {
        const escaped = value
          .replace(/\\\\/g, '\\')
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
        return `"${field}": "${escaped}"`
      })
    }

    fixed = fixed.replace(/:\s*"([^"]*(?:\\.[^"]*)*)"\s*([,}\]])/g, (match, value, end) => {
      if (value.includes('"') && !value.match(/\\"/)) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `: "${escaped}"${end}`
      }
      return match
    })

    return fixed
  }

  private fixJsonAdvanced(jsonStr: string): string {
    let fixed = jsonStr

    fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    const lastBrace = fixed.lastIndexOf('}')
    if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
      fixed = fixed.substring(0, lastBrace + 1)
    }

    fixed = this.escapeUnescapedQuotesInStrings(fixed)

    return fixed
  }

  private escapeUnescapedQuotesInStrings(jsonStr: string): string {
    let result = ''
    let inString = false
    let escapeNext = false

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i]

      if (escapeNext) {
        result += char
        escapeNext = false
        continue
      }

      if (char === '\\') {
        result += char
        escapeNext = true
        continue
      }

      if (char === '"') {
        if (!inString) {
          inString = true
          result += char
        } else {
          const nextChar = i + 1 < jsonStr.length ? jsonStr[i + 1] : ''
          if (
            nextChar === ':' ||
            nextChar === ',' ||
            nextChar === '}' ||
            nextChar === ']' ||
            nextChar === '\n' ||
            nextChar === '\r' ||
            nextChar === ' '
          ) {
            inString = false
            result += char
          } else {
            result += '\\"'
          }
        }
      } else {
        result += char
      }
    }

    return result
  }

  private extractProfileFallback(
    memories: Array<{
      id: string
      title: string | null
      content_preview?: string | null
      content: string
      created_at: Date
      page_metadata: Prisma.JsonValue
    }>
  ): ProfileExtractionResult {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const allTopics = new Set<string>()
    const allCategories = new Set<string>()
    const recentTopics = new Set<string>()
    const recentCategories = new Set<string>()

    memories.forEach(m => {
      const metadata = m.page_metadata as Record<string, unknown> | null
      const isRecent = m.created_at >= thirtyDaysAgo

      if (metadata?.topics && Array.isArray(metadata.topics)) {
        metadata.topics.forEach((topic: unknown) => {
          if (typeof topic === 'string') {
            allTopics.add(topic)
            if (isRecent) recentTopics.add(topic)
          }
        })
      }

      if (metadata?.categories && Array.isArray(metadata.categories)) {
        metadata.categories.forEach((cat: unknown) => {
          if (typeof cat === 'string') {
            allCategories.add(cat)
            if (isRecent) recentCategories.add(cat)
          }
        })
      }
    })

    const staticProfile: StaticProfile = {
      interests: Array.from(allTopics).slice(0, 10),
      skills: [],
      long_term_patterns: Array.from(allCategories).slice(0, 5),
      domains: Array.from(allCategories).slice(0, 5),
      expertise_areas: Array.from(allTopics).slice(0, 5),
      personality_traits: [],
      work_style: {},
      communication_style: {},
      learning_preferences: {},
      values_and_priorities: [],
      technology_preferences: {},
      lifestyle_patterns: {},
      cognitive_style: {},
      personal_narrative: {
        who: `User interested in: ${Array.from(allTopics).slice(0, 5).join(', ')}`,
        why: 'Motivations and goals inferred from content patterns',
        what: `Active in: ${Array.from(allCategories).slice(0, 3).join(', ')}`,
        how: 'Approach and methods inferred from engagement patterns',
      },
    }

    const dynamicProfile: DynamicProfile = {
      recent_activities: Array.from(recentTopics).slice(0, 5),
      current_projects: [],
      temporary_interests: Array.from(recentTopics).slice(0, 5),
      recent_changes: [],
      current_context: Array.from(recentCategories).slice(0, 3),
      active_goals: [],
      current_challenges: [],
      recent_achievements: [],
      current_focus_areas: [],
      emotional_state: {},
      active_research_topics: Array.from(recentTopics).slice(0, 5),
      upcoming_events: [],
    }

    const staticText = `This user is interested in: ${Array.from(allTopics).slice(0, 10).join(', ')}. They are active in domains: ${Array.from(allCategories).slice(0, 5).join(', ')}. Their long-term patterns include engagement with: ${Array.from(allCategories).slice(0, 5).join(', ')}.`

    const dynamicText = `Currently, this user is recently interested in: ${Array.from(recentTopics).slice(0, 10).join(', ')}. Their recent activities focus on: ${Array.from(recentCategories).slice(0, 5).join(', ')}.`

    return {
      static_profile_json: staticProfile,
      static_profile_text: staticText,
      dynamic_profile_json: dynamicProfile,
      dynamic_profile_text: dynamicText,
    }
  }

  private getEmptyProfile(): ProfileExtractionResult {
    return {
      static_profile_json: {
        interests: [],
        skills: [],
        long_term_patterns: [],
        domains: [],
        expertise_areas: [],
        personality_traits: [],
        work_style: {},
        communication_style: {},
        learning_preferences: {},
        values_and_priorities: [],
        technology_preferences: {},
        lifestyle_patterns: {},
        cognitive_style: {},
        personal_narrative: {
          who: 'No profile information available yet. Profile will be built as the user creates memories and engages with content.',
          why: 'No profile information available yet. Motivations and goals will be inferred as more information becomes available.',
          what: 'No profile information available yet. Interests and activities will be identified as the user saves content.',
          how: 'No profile information available yet. Work style and preferences will be determined from user behavior patterns.',
        },
      },
      static_profile_text:
        'No profile information available yet. A comprehensive profile will be built as the user creates memories and engages with content. The profile will capture their complete identity, personality, preferences, work style, communication style, learning preferences, values, thinking patterns, and unique characteristics.',
      dynamic_profile_json: {
        recent_activities: [],
        current_projects: [],
        temporary_interests: [],
        recent_changes: [],
        current_context: [],
        active_goals: [],
        current_challenges: [],
        recent_achievements: [],
        current_focus_areas: [],
        emotional_state: {},
        active_research_topics: [],
        upcoming_events: [],
      },
      dynamic_profile_text:
        'No recent context available yet. Current activities, goals, challenges, and focus areas will be identified as the user creates new memories.',
    }
  }
}

export const profileExtractionService = new ProfileExtractionService()
