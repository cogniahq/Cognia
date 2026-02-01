import { GoogleGenAI } from '@google/genai'
import { runWithRateLimit } from './gemini-rate-limiter.service'
import type { GeminiResponse, GeminiError, ContentMetadata } from '../../types/ai.types'

export class GeminiGenerationService {
  private ai: GoogleGenAI | null
  private availableModels: string[] = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
  ]
  private currentModelIndex: number = 0

  constructor(ai: GoogleGenAI | null) {
    this.ai = ai
  }

  private ensureInit() {
    if (!this.ai) throw new Error('Gemini service not initialized. Set GEMINI_API_KEY.')
  }

  get isInitialized(): boolean {
    return !!this.ai
  }

  private getCurrentModel(): string {
    return this.availableModels[this.currentModelIndex]
  }

  private switchToNextModel(): boolean {
    if (this.currentModelIndex < this.availableModels.length - 1) {
      this.currentModelIndex++
      return true
    }
    return false
  }

  private resetToFirstModel(): void {
    this.currentModelIndex = 0
  }

  private isRateLimitError(err: Error | GeminiError): boolean {
    const error = err as GeminiError
    return (
      error?.status === 429 ||
      error?.status === 503 ||
      error?.message?.toLowerCase().includes('quota') ||
      error?.message?.toLowerCase().includes('rate limit') ||
      error?.message?.toLowerCase().includes('too many requests') ||
      error?.message?.toLowerCase().includes('overloaded')
    )
  }

  async generateContent(
    prompt: string,
    isSearchRequest: boolean = false,
    timeoutOverride?: number,
    isEmailDraft: boolean = false
  ): Promise<{ text: string; modelUsed?: string; inputTokens?: number; outputTokens?: number }> {
    this.ensureInit()

    const enhancedPrompt = `${prompt}

CRITICAL: Return ONLY plain text content. Do not use any markdown formatting including:
- No asterisks (*) for bold or italic text
- No underscores (_) for emphasis
- No backticks for code blocks
- No hash symbols (#) for headers
- No brackets [] or parentheses () for links
- No special characters for formatting
- No bullet points with dashes or asterisks
- No numbered lists with special formatting

Return clean, readable plain text only.`

    let lastError: Error | GeminiError | undefined
    const originalModelIndex = this.currentModelIndex
    const priority = isSearchRequest ? 10 : isEmailDraft ? 9 : 0

    while (this.currentModelIndex < this.availableModels.length) {
      try {
        const timeoutMs = timeoutOverride ?? (isSearchRequest ? 300000 : 360000)
        const shouldBypassRateLimit = isEmailDraft || isSearchRequest

        const response = await runWithRateLimit(
          () =>
            this.ai!.models.generateContent({
              model: this.getCurrentModel(),
              contents: enhancedPrompt,
            }),
          timeoutMs,
          shouldBypassRateLimit,
          priority
        )
        if (!response.text) throw new Error('No content generated from Gemini API')

        const usageMetadata = (response as GeminiResponse).usageMetadata
        const inputTokens = usageMetadata?.promptTokenCount || 0
        const outputTokens = usageMetadata?.candidatesTokenCount || 0
        const modelUsed = this.getCurrentModel()

        this.resetToFirstModel()
        return { text: response.text, modelUsed, inputTokens, outputTokens }
      } catch (err) {
        const error = err as Error | GeminiError
        lastError = error

        if (this.isRateLimitError(error)) {
          if (!this.switchToNextModel()) {
            break
          }
        } else {
          break
        }
      }
    }

    this.currentModelIndex = originalModelIndex
    throw lastError
  }

  async summarizeContent(
    rawText: string,
    metadata?: ContentMetadata,
    timeoutOverride?: number
  ): Promise<{ text: string; modelUsed?: string; inputTokens?: number; outputTokens?: number }> {
    this.ensureInit()

    const contentType = metadata?.content_type || 'web_page'
    const title = metadata?.title || ''
    const url = metadata?.url || ''
    const contextSummary = metadata?.content_summary || ''
    const keyTopics = metadata?.key_topics || []

    const baseContext = `
    Cognia Memory Context:
    - This system captures, anchors, and reasons over user knowledge.
    - Each summary must preserve conceptual and factual signals that aid downstream embedding and memory linkage.
    - Focus on what this content teaches, why it matters, and how it connects to user knowledge evolution.
    `

    const prompts: Record<string, string> = {
      blog_post: `Summarize this blog post for Cognia memory storage. Extract conceptual essence, useful principles, and any links to AI reasoning or systems thinking. Limit to 200 words.`,
      article: `Summarize this article emphasizing the knowledge kernel — ideas worth remembering in context of verifiable cognition. Capture main argument, supporting evidence, and conceptual contribution. 200 words max.`,
      documentation: `Summarize this documentation for knowledge anchoring. Include system purpose, key methods, conceptual model, and when it's relevant. Preserve implementation-level cues for retrieval. 200 words.`,
      tutorial: `Summarize this tutorial as a learning trace. Identify goal, key procedures, conceptual lessons, and result. Summaries must support future reasoning and contextual retrieval. 200 words.`,
      news_article: `Summarize this news article for cognition memory. Focus on what happened, implications, and how it alters knowledge or perception. 200 words.`,
      code_repository: `Summarize this repository for embedding into Cognia. Include purpose, architecture, dependencies, and conceptual innovation. Avoid trivial descriptions. 200 words.`,
      qa_thread: `Summarize this Q&A for retrieval. Capture the problem, reasoning behind the best answer, and generalizable lessons. 200 words.`,
      video_content: `Summarize this video for conceptual retention. Capture teaching points, narrative logic, and actionable outcomes. 200 words.`,
      social_media: `Summarize this post as an idea capsule. Focus on expressed insight, argument, and why it may shape user reasoning. 150 words.`,
      default: `Summarize this content for Cognia memory graph. Capture topic, insights, implications, and long-term relevance. 200 words.`,
    }

    const prompt = `
${baseContext}
Title: ${title}
URL: ${url}
Existing Summary: ${contextSummary}
Topics: ${keyTopics.join(', ')}

${prompts[contentType] || prompts.default}

CRITICAL: Return ONLY plain text content. Do not use any markdown formatting including:
- No asterisks (*) for bold or italic text
- No underscores (_) for emphasis
- No backticks for code blocks
- No hash symbols (#) for headers
- No brackets [] or parentheses () for links
- No special characters for formatting
- No bullet points with dashes or asterisks
- No numbered lists with special formatting

Return clean, readable plain text only.

Raw Content: ${rawText}
`

    let lastError: Error | GeminiError | undefined
    const originalModelIndex = this.currentModelIndex

    while (this.currentModelIndex < this.availableModels.length) {
      try {
        const timeoutMs = timeoutOverride ?? 360000
        const res = await runWithRateLimit(
          () =>
            this.ai!.models.generateContent({
              model: this.getCurrentModel(),
              contents: prompt,
            }),
          timeoutMs
        )
        if (!res.text) throw new Error('No summary generated from Gemini API')

        const usageMetadata = (res as GeminiResponse).usageMetadata
        const inputTokens = usageMetadata?.promptTokenCount || 0
        const outputTokens = usageMetadata?.candidatesTokenCount || 0
        const modelUsed = this.getCurrentModel()

        this.resetToFirstModel()
        return { text: res.text.trim(), modelUsed, inputTokens, outputTokens }
      } catch (err) {
        lastError = err

        if (this.isRateLimitError(err)) {
          if (!this.switchToNextModel()) {
            break
          }
        } else {
          break
        }
      }
    }

    this.currentModelIndex = originalModelIndex
    throw lastError
  }

  async extractContentMetadata(
    rawText: string,
    metadata?: ContentMetadata,
    timeoutOverride?: number
  ): Promise<{
    metadata: {
      topics: string[]
      categories: string[]
      keyPoints: string[]
      sentiment: string
      importance: number
      usefulness: number
      searchableTerms: string[]
      contextRelevance: string[]
    }
    modelUsed?: string
    inputTokens?: number
    outputTokens?: number
  }> {
    this.ensureInit()

    const title = metadata?.title || ''
    const url = metadata?.url || ''
    const contentType = metadata?.content_type || 'web_page'

    const prompt = `
Cognia Context:
- You are structuring content for verifiable personal cognition.
- Metadata must improve future reasoning, search, and memory linking.

CRITICAL: Return ONLY valid JSON. No explanations, no markdown formatting, no code blocks, no special characters. Just the JSON object.

Return a JSON object with this exact structure:
{
  "topics": ["precise conceptual domains"],
  "categories": ["broader knowledge classes"],
  "keyPoints": ["concise factual or conceptual insights"],
  "sentiment": "educational",
  "importance": 5,
  "usefulness": 5,
  "searchableTerms": ["semantic anchors for retrieval"],
  "contextRelevance": ["contexts where this memory helps reasoning"]
}

Rules:
- All strings must be in double quotes
- No trailing commas
- sentiment must be one of: "educational", "technical", "neutral", "analytical"
- importance and usefulness must be numbers between 1-10
- All arrays can be empty if no relevant items

Title: ${title}
URL: ${url}
Content Type: ${contentType}
Text: ${rawText.substring(0, 4000)}

Return ONLY the JSON object:`

    const originalModelIndex = this.currentModelIndex

    while (this.currentModelIndex < this.availableModels.length) {
      try {
        const timeoutMs = timeoutOverride ?? 360000
        const res = await runWithRateLimit(
          () =>
            this.ai!.models.generateContent({
              model: this.getCurrentModel(),
              contents: prompt,
            }),
          timeoutMs
        )
        if (!res.text) throw new Error('No metadata response from Gemini API')

        let jsonMatch = res.text.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
          jsonMatch = res.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
          if (jsonMatch) {
            jsonMatch[0] = jsonMatch[1]
          }
        }

        if (!jsonMatch) {
          jsonMatch = res.text.match(/\{[\s\S]*?\}/)
        }

        if (!jsonMatch) {
          throw new Error('Invalid JSON in Gemini response')
        }

        let data
        try {
          data = JSON.parse(jsonMatch[0])
        } catch {
          let fixedJson = jsonMatch[0]

          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1')
          fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

          try {
            data = JSON.parse(fixedJson)
          } catch {
            this.resetToFirstModel()
            return {
              metadata: {
                topics: [],
                categories: ['web_page'],
                keyPoints: [],
                sentiment: 'neutral',
                importance: 5,
                usefulness: 5,
                searchableTerms: [],
                contextRelevance: [],
              },
              modelUsed: undefined,
              inputTokens: 0,
              outputTokens: 0,
            }
          }
        }

        const validSentiments = ['educational', 'technical', 'neutral', 'analytical']
        const sentiment = validSentiments.includes(data.sentiment) ? data.sentiment : 'neutral'

        const usageMetadata = (res as GeminiResponse).usageMetadata
        const inputTokens = usageMetadata?.promptTokenCount || 0
        const outputTokens = usageMetadata?.candidatesTokenCount || 0
        const modelUsed = this.getCurrentModel()

        this.resetToFirstModel()
        return {
          metadata: {
            topics: Array.isArray(data.topics) ? data.topics.slice(0, 10) : [],
            categories: Array.isArray(data.categories) ? data.categories.slice(0, 5) : ['web_page'],
            keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints.slice(0, 8) : [],
            sentiment: sentiment,
            importance: Math.max(1, Math.min(10, parseInt(data.importance) || 5)),
            usefulness: Math.max(1, Math.min(10, parseInt(data.usefulness) || 5)),
            searchableTerms: Array.isArray(data.searchableTerms)
              ? data.searchableTerms.slice(0, 15)
              : [],
            contextRelevance: Array.isArray(data.contextRelevance)
              ? data.contextRelevance.slice(0, 5)
              : [],
          },
          modelUsed,
          inputTokens,
          outputTokens,
        }
      } catch (err) {
        if (this.isRateLimitError(err)) {
          if (!this.switchToNextModel()) {
            break
          }
        } else {
          break
        }
      }
    }

    this.currentModelIndex = originalModelIndex
    return {
      metadata: {
        topics: metadata?.key_topics?.slice(0, 5) || [],
        categories: [metadata?.content_type || 'web_page'],
        keyPoints: [],
        sentiment: 'neutral',
        importance: 5,
        usefulness: 5,
        searchableTerms: [],
        contextRelevance: [],
      },
      modelUsed: undefined,
      inputTokens: 0,
      outputTokens: 0,
    }
  }

  async evaluateMemoryRelationship(
    memoryA: { title?: string; content?: string; topics?: string[]; categories?: string[] },
    memoryB: { title?: string; content?: string; topics?: string[]; categories?: string[] }
  ): Promise<{
    isRelevant: boolean
    relevanceScore: number
    relationshipType: string
    reasoning: string
  }> {
    this.ensureInit()

    const prompt = `
Cognia Memory Relationship Evaluation
- You are mapping conceptual and temporal relationships within a user's verifiable cognition graph.
- Relationships exist when memories share conceptual, methodological, or contextual synergy useful for reasoning.

Memory A:
Title: ${memoryA.title || 'N/A'}
Content: ${memoryA.content || 'N/A'}
Topics: ${memoryA.topics?.join(', ') || 'N/A'}
Categories: ${memoryA.categories?.join(', ') || 'N/A'}

Memory B:
Title: ${memoryB.title || 'N/A'}
Content: ${memoryB.content || 'N/A'}
Topics: ${memoryB.topics?.join(', ') || 'N/A'}
Categories: ${memoryB.categories?.join(', ') || 'N/A'}

CRITICAL: Return ONLY valid JSON. No explanations, no markdown formatting, no code blocks, no special characters. Just the JSON object.

Return a JSON object with this exact structure:
{
  "isRelevant": true,
  "relevanceScore": 0.5,
  "relationshipType": "conceptual",
  "reasoning": "short explanation"
}

Rules:
- All strings must be in double quotes
- No trailing commas
- isRelevant must be true or false
- relevanceScore must be a number between 0 and 1
- relationshipType must be one of: "conceptual", "topical", "contextual", "temporal", "causal", "none"
- reasoning must be a string

Return ONLY the JSON object:

Criteria:
- Conceptual: Shared frameworks or ideas (e.g. verifiable compute, cognition models)
- Topical: Same field or recurring subject
- Contextual: Appear in same temporal or thematic window
- Temporal: Sequential evolution of user's knowledge
- Causal: One leads to insight in another
Be strict. Avoid weak or surface matches.
`

    const originalModelIndex = this.currentModelIndex

    while (this.currentModelIndex < this.availableModels.length) {
      try {
        const res = await runWithRateLimit(
          () =>
            this.ai!.models.generateContent({
              model: this.getCurrentModel(),
              contents: prompt,
            }),
          360000
        )
        if (!res.text) throw new Error('No relationship data from Gemini')

        let jsonMatch = res.text.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
          jsonMatch = res.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
          if (jsonMatch) {
            jsonMatch[0] = jsonMatch[1]
          }
        }

        if (!jsonMatch) {
          jsonMatch = res.text.match(/\{[\s\S]*?\}/)
        }

        if (!jsonMatch) {
          throw new Error('Invalid JSON response from Gemini')
        }

        let data
        try {
          data = JSON.parse(jsonMatch[0])
        } catch {
          let fixedJson = jsonMatch[0]
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1')
          fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

          try {
            data = JSON.parse(fixedJson)
          } catch {
            this.resetToFirstModel()
            return {
              isRelevant: false,
              relevanceScore: 0,
              relationshipType: 'none',
              reasoning: 'JSON parsing failed, defaulting to no relationship',
            }
          }
        }

        this.resetToFirstModel()
        return {
          isRelevant: !!data.isRelevant,
          relevanceScore: Math.max(0, Math.min(1, data.relevanceScore || 0)),
          relationshipType: data.relationshipType || 'none',
          reasoning: data.reasoning || 'No reasoning provided',
        }
      } catch (err) {
        if (this.isRateLimitError(err)) {
          if (!this.switchToNextModel()) {
            break
          }
        } else {
          break
        }
      }
    }

    this.currentModelIndex = originalModelIndex
    const topicOverlap = memoryA.topics?.some(t => memoryB.topics?.includes(t)) || false
    const categoryOverlap = memoryA.categories?.some(c => memoryB.categories?.includes(c)) || false
    const score =
      topicOverlap && categoryOverlap ? 0.9 : topicOverlap ? 0.6 : categoryOverlap ? 0.4 : 0
    return {
      isRelevant: score > 0,
      relevanceScore: score,
      relationshipType: topicOverlap ? 'topical' : categoryOverlap ? 'categorical' : 'none',
      reasoning:
        score > 0
          ? 'Topic/category overlap detected (fallback logic).'
          : 'No meaningful connection.',
    }
  }

  async generateContentWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    timeoutOverride?: number
  ): Promise<string> {
    this.ensureInit()

    const originalModelIndex = this.currentModelIndex
    let lastError: Error | GeminiError | undefined

    while (this.currentModelIndex < this.availableModels.length) {
      try {
        const timeoutMs = timeoutOverride ?? 360000

        const response = await runWithRateLimit(
          () =>
            this.ai!.models.generateContent({
              model: this.getCurrentModel(),
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: imageBase64,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
            }),
          timeoutMs
        )

        if (!response.text) throw new Error('No content generated from Gemini Vision API')

        this.resetToFirstModel()
        return response.text
      } catch (err) {
        lastError = err as Error | GeminiError

        if (this.isRateLimitError(lastError)) {
          if (!this.switchToNextModel()) {
            break
          }
        } else {
          break
        }
      }
    }

    this.currentModelIndex = originalModelIndex
    throw lastError || new Error('Failed to generate content with image')
  }
}
