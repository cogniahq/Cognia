import { geminiService } from './gemini.service'
import { tokenTracking } from '../core/token-tracking.service'
import { logger } from '../../utils/core/logger.util'
import { embeddingProviderService } from './embedding-provider.service'
import { generationProviderService } from './generation-provider.service'

type Provider = 'gemini' | 'ollama' | 'hybrid'

const legacyProvider: Provider = (process.env.AI_PROVIDER as Provider) || 'hybrid'
const embedProvider: Provider = (process.env.EMBED_PROVIDER as Provider) || legacyProvider
const genProvider: Provider = (process.env.GEN_PROVIDER as Provider) || legacyProvider

logger.log('AI Provider Configuration', {
  embedProvider,
  genProvider,
})

export const aiProvider = {
  get isInitialized(): boolean {
    const needsGemini = embedProvider === 'gemini' || genProvider === 'gemini'
    if (needsGemini) {
      const isInit = geminiService.isInitialized
      if (!isInit) {
        logger.warn('Gemini service not initialized. Check GEMINI_API_KEY environment variable.')
      }
      return isInit
    }
    return true
  },

  async generateEmbedding(text: string, userId?: string): Promise<number[]> {
    return embeddingProviderService.generateEmbedding(text, userId)
  },

  generateFallbackEmbedding(text: string): number[] {
    return embeddingProviderService.generateFallbackEmbedding(text)
  },

  async generateContent(
    prompt: string,
    isSearchRequest: boolean = false,
    userId?: string,
    timeoutOverride?: number,
    isEmailDraft: boolean = false
  ): Promise<string> {
    return generationProviderService.generateContent(
      prompt,
      isSearchRequest,
      userId,
      timeoutOverride,
      isEmailDraft
    )
  },

  async extractContentMetadata(
    rawText: string,
    metadata?: Record<string, unknown>,
    userId?: string,
    timeoutOverride?: number
  ): Promise<{
    topics: string[]
    categories: string[]
    keyPoints: string[]
    sentiment: string
    importance: number
    usefulness: number
    searchableTerms: string[]
    contextRelevance: string[]
  }> {
    let result: {
      topics: string[]
      categories: string[]
      keyPoints: string[]
      sentiment: string
      importance: number
      usefulness: number
      searchableTerms: string[]
      contextRelevance: string[]
    }
    let modelUsed: string | undefined

    if (genProvider === 'gemini') {
      const response = await geminiService.extractContentMetadata(
        rawText,
        metadata,
        timeoutOverride
      )
      result = response.metadata
      modelUsed = response.modelUsed
    } else {
      const title = metadata?.title || ''
      const contentType = metadata?.content_type || 'web_page'
      const jsonPrompt = `Extract metadata from this content. Respond with ONLY a valid JSON object, no explanations or text before/after.

CRITICAL: Return ONLY valid JSON. No explanations, no markdown formatting, no code blocks, no special characters. Just the JSON object.

Title: ${title}
Content: ${rawText.substring(0, 2000)}

Required JSON format:
{"topics": ["keyword1", "keyword2"], "categories": ["${contentType}"], "keyPoints": ["point1", "point2"], "sentiment": "neutral", "importance": 5, "usefulness": 5, "searchableTerms": ["term1", "term2"], "contextRelevance": ["type"]}

Rules:
- sentiment: educational, technical, neutral, analytical, positive, negative
- importance/usefulness: numbers 1-10
- topics: 2-4 relevant keywords from content
- keyPoints: 2-3 main points (max 80 chars each)
- searchableTerms: 5-8 important words
- contextRelevance: array of relevant types from: educational, current_events, analysis, code_review, code_repository, issue_tracking, technical_documentation, devops, security, performance, general

JSON ONLY:`
      const out = await generationProviderService.generateContent(jsonPrompt, false, userId)
      try {
        // Clean up the response to extract JSON
        let jsonStr = out.trim()

        // Remove common prefixes that AI models add
        jsonStr = jsonStr.replace(/^(Here is|Here's|The JSON|JSON response|Response:|Answer:)/i, '')
        jsonStr = jsonStr.replace(/^(Here is the|Here's the|The extracted|Extracted)/i, '')

        // Remove any markdown code blocks
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '')

        // Remove any text before the first {
        const firstBrace = jsonStr.indexOf('{')
        if (firstBrace > 0) {
          jsonStr = jsonStr.substring(firstBrace)
        }

        // Find the last } to extract complete JSON
        const lastBrace = jsonStr.lastIndexOf('}')
        if (lastBrace !== -1) {
          jsonStr = jsonStr.substring(0, lastBrace + 1)
        }

        // Remove any trailing text after the last }
        jsonStr = jsonStr.trim()

        const obj = JSON.parse(jsonStr)
        result = {
          topics: Array.isArray(obj.topics) ? obj.topics : [],
          categories: Array.isArray(obj.categories) ? obj.categories : [contentType],
          keyPoints: Array.isArray(obj.keyPoints) ? obj.keyPoints : [],
          sentiment: typeof obj.sentiment === 'string' ? obj.sentiment : 'neutral',
          importance: Number(obj.importance) || 5,
          usefulness: Number(obj.usefulness) || 5,
          searchableTerms: Array.isArray(obj.searchableTerms) ? obj.searchableTerms : [],
          contextRelevance: Array.isArray(obj.contextRelevance) ? obj.contextRelevance : [],
        }
      } catch (error) {
        logger.error('Error extracting metadata with AI, using fallback:', error)
        result = this.generateFallbackMetadata(rawText, metadata)
      }
    }

    if (userId) {
      const inputTokens = tokenTracking.estimateTokens(rawText)
      const outputTokens = tokenTracking.estimateTokens(JSON.stringify(result))
      await tokenTracking.recordTokenUsage({
        userId,
        operationType: 'generate_content',
        inputTokens,
        outputTokens,
        modelUsed,
      })
    }

    return result
  },

  async generateContentWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    timeoutOverride?: number
  ): Promise<string> {
    // Image processing requires Gemini (vision models)
    return geminiService.generateContentWithImage(prompt, imageBase64, mimeType, timeoutOverride)
  },

  generateFallbackMetadata(
    rawText: string,
    metadata?: Record<string, unknown>
  ): {
    topics: string[]
    categories: string[]
    keyPoints: string[]
    sentiment: string
    importance: number
    usefulness: number
    searchableTerms: string[]
    contextRelevance: string[]
  } {
    const title = typeof metadata?.title === 'string' ? metadata.title : ''
    const contentType =
      typeof metadata?.content_type === 'string' ? metadata.content_type : 'web_page'
    const text = (title + ' ' + rawText).toLowerCase()

    // Extract topics based on common keywords
    const topics: string[] = []
    if (
      text.includes('mac') ||
      text.includes('apple') ||
      text.includes('computer') ||
      text.includes('laptop') ||
      text.includes('desktop')
    ) {
      topics.push('technology', 'computers')
    }
    if (
      text.includes('iphone') ||
      text.includes('mobile') ||
      text.includes('phone') ||
      text.includes('smartphone')
    ) {
      topics.push('technology', 'mobile')
    }
    if (
      text.includes('job') ||
      text.includes('career') ||
      text.includes('work') ||
      text.includes('employment') ||
      text.includes('hiring')
    ) {
      topics.push('career', 'employment')
    }
    if (
      text.includes('health') ||
      text.includes('medical') ||
      text.includes('doctor') ||
      text.includes('medicine')
    ) {
      topics.push('health', 'medical')
    }
    if (
      text.includes('travel') ||
      text.includes('trip') ||
      text.includes('vacation') ||
      text.includes('tourism')
    ) {
      topics.push('travel', 'tourism')
    }
    if (
      text.includes('food') ||
      text.includes('restaurant') ||
      text.includes('cooking') ||
      text.includes('recipe')
    ) {
      topics.push('food', 'dining')
    }
    if (
      text.includes('education') ||
      text.includes('learning') ||
      text.includes('school') ||
      text.includes('university')
    ) {
      topics.push('education', 'learning')
    }
    if (
      text.includes('business') ||
      text.includes('finance') ||
      text.includes('money') ||
      text.includes('investment')
    ) {
      topics.push('business', 'finance')
    }
    if (
      text.includes('entertainment') ||
      text.includes('movie') ||
      text.includes('music') ||
      text.includes('game')
    ) {
      topics.push('entertainment', 'media')
    }

    // Extract key points from text
    const keyPoints: string[] = []
    const sentences = rawText.split(/[.!?]+/).filter(s => s.trim().length > 20)
    keyPoints.push(...sentences.slice(0, 3).map(s => s.trim().substring(0, 100)))

    // Determine sentiment
    let sentiment = 'neutral'
    const positiveWords = [
      'great',
      'excellent',
      'amazing',
      'love',
      'best',
      'fantastic',
      'wonderful',
      'awesome',
      'perfect',
      'outstanding',
      'superb',
      'brilliant',
    ]
    const negativeWords = [
      'bad',
      'terrible',
      'hate',
      'awful',
      'worst',
      'horrible',
      'disgusting',
      'disappointing',
      'frustrating',
      'annoying',
      'useless',
      'broken',
    ]

    const positiveCount = positiveWords.filter(word => text.includes(word)).length
    const negativeCount = negativeWords.filter(word => text.includes(word)).length

    if (positiveCount > negativeCount && positiveCount > 0) {
      sentiment = 'positive'
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      sentiment = 'negative'
    } else if (
      text.includes('tutorial') ||
      text.includes('guide') ||
      text.includes('how to') ||
      text.includes('learn')
    ) {
      sentiment = 'educational'
    } else if (
      text.includes('review') ||
      text.includes('analysis') ||
      text.includes('comparison') ||
      text.includes('evaluation')
    ) {
      sentiment = 'analytical'
    } else if (
      text.includes('technical') ||
      text.includes('specification') ||
      text.includes('documentation') ||
      text.includes('api')
    ) {
      sentiment = 'technical'
    }

    // Determine importance and usefulness based on content type and length
    let importance = 5
    let usefulness = 5

    if (contentType === 'web_page' && rawText.length > 1000) {
      importance = 7
      usefulness = 6
    } else if (contentType === 'social_media') {
      importance = 3
      usefulness = 4
    }

    // Extract searchable terms
    const searchableTerms: string[] = []
    const words = text.split(/\s+/).filter(w => w.length > 3)
    const wordCounts = new Map<string, number>()
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    })
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
    searchableTerms.push(...sortedWords)

    // Context relevance
    const contextRelevance: string[] = []
    const lowerText = text.toLowerCase()
    if (
      lowerText.includes('tutorial') ||
      lowerText.includes('guide') ||
      lowerText.includes('how to') ||
      lowerText.includes('learn') ||
      lowerText.includes('documentation')
    ) {
      contextRelevance.push('educational')
    }
    if (
      lowerText.includes('news') ||
      lowerText.includes('update') ||
      lowerText.includes('latest') ||
      lowerText.includes('announcement')
    ) {
      contextRelevance.push('current_events')
    }
    if (
      lowerText.includes('review') ||
      lowerText.includes('opinion') ||
      lowerText.includes('analysis') ||
      lowerText.includes('feedback')
    ) {
      contextRelevance.push('analysis')
    }
    if (
      lowerText.includes('pull request') ||
      lowerText.includes('pr #') ||
      lowerText.includes('merge request') ||
      lowerText.includes('code review')
    ) {
      contextRelevance.push('code_review')
    }
    if (
      lowerText.includes('github.com') ||
      lowerText.includes('gitlab.com') ||
      lowerText.includes('bitbucket') ||
      lowerText.includes('repository') ||
      lowerText.includes('repo')
    ) {
      contextRelevance.push('code_repository')
    }
    if (
      lowerText.includes('issue') ||
      lowerText.includes('bug') ||
      lowerText.includes('feature request') ||
      lowerText.includes('enhancement')
    ) {
      contextRelevance.push('issue_tracking')
    }
    if (
      lowerText.includes('api') ||
      lowerText.includes('endpoint') ||
      lowerText.includes('rest') ||
      lowerText.includes('graphql')
    ) {
      contextRelevance.push('technical_documentation')
    }
    if (
      lowerText.includes('deployment') ||
      lowerText.includes('ci/cd') ||
      lowerText.includes('pipeline') ||
      lowerText.includes('build')
    ) {
      contextRelevance.push('devops')
    }
    if (
      lowerText.includes('security') ||
      lowerText.includes('vulnerability') ||
      lowerText.includes('cve') ||
      lowerText.includes('exploit')
    ) {
      contextRelevance.push('security')
    }
    if (
      lowerText.includes('performance') ||
      lowerText.includes('optimization') ||
      lowerText.includes('benchmark') ||
      lowerText.includes('metrics')
    ) {
      contextRelevance.push('performance')
    }

    return {
      topics: topics.length > 0 ? topics : ['general'],
      categories: [contentType],
      keyPoints: keyPoints.filter(kp => kp.length > 0),
      sentiment,
      importance,
      usefulness,
      searchableTerms: searchableTerms.slice(0, 10),
      contextRelevance: contextRelevance.length > 0 ? contextRelevance : ['general'],
    }
  },
}
