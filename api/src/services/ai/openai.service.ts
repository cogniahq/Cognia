import OpenAI from 'openai'
import { logger } from '../../utils/core/logger.util'
import {
  getOpenAIApiKey,
  getOpenAIChatModel,
  getOpenAIEmbeddingModel,
  getOpenAIVisionModel,
} from './ai-config'

class OpenAIService {
  private client: OpenAI | null = null
  private activeApiKey: string | null = null

  get isInitialized(): boolean {
    return !!getOpenAIApiKey()
  }

  private getClient(): OpenAI {
    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }

    if (!this.client || this.activeApiKey !== apiKey) {
      this.client = new OpenAI({ apiKey })
      this.activeApiKey = apiKey
    }

    return this.client
  }

  /**
   * Generate text content using OpenAI
   */
  async generateContent(
    prompt: string,
    isSearchRequest: boolean = false,
    timeoutOverride?: number
  ): Promise<{ text: string; modelUsed: string }> {
    const client = this.getClient()
    const startTime = Date.now()

    try {
      const model = getOpenAIChatModel()

      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: isSearchRequest ? 1024 : 2048,
          temperature: isSearchRequest ? 0.3 : 0.7,
        },
        timeoutOverride ? { timeout: timeoutOverride } : undefined
      )

      const text = response.choices[0]?.message?.content || ''
      const elapsed = Date.now() - startTime

      logger.log('[openai] content generated', {
        model,
        promptLength: prompt.length,
        responseLength: text.length,
        elapsedMs: elapsed,
        isSearchRequest,
      })

      return { text, modelUsed: model }
    } catch (error) {
      logger.error('[openai] generation failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbedding(text: string): Promise<{ embedding: number[]; modelUsed: string }> {
    const client = this.getClient()
    const startTime = Date.now()

    try {
      // Truncate text if too long (OpenAI has token limits)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text
      const embeddingModel = getOpenAIEmbeddingModel()

      const response = await client.embeddings.create({
        model: embeddingModel,
        input: truncatedText,
      })

      const embedding = response.data[0]?.embedding || []
      const elapsed = Date.now() - startTime

      logger.log('[openai] embedding generated', {
        model: embeddingModel,
        textLength: truncatedText.length,
        embeddingDimensions: embedding.length,
        elapsedMs: elapsed,
      })

      return { embedding, modelUsed: embeddingModel }
    } catch (error) {
      logger.error('[openai] embedding failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Batched embedding. OpenAI accepts up to 2048 inputs per request and is the
   * preferred ingest path — one round-trip per chunk batch instead of N.
   */
  async generateEmbeddingsBatch(
    texts: string[]
  ): Promise<{ embeddings: number[][]; modelUsed: string }> {
    if (texts.length === 0) return { embeddings: [], modelUsed: getOpenAIEmbeddingModel() }

    const client = this.getClient()
    const startTime = Date.now()
    const embeddingModel = getOpenAIEmbeddingModel()
    const truncated = texts.map(t => (t.length > 8000 ? t.substring(0, 8000) : t))

    try {
      const response = await client.embeddings.create({
        model: embeddingModel,
        input: truncated,
      })

      const sorted = [...response.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const embeddings = sorted.map(item => item.embedding || [])

      logger.log('[openai] batch embedding generated', {
        model: embeddingModel,
        batchSize: texts.length,
        elapsedMs: Date.now() - startTime,
      })

      return { embeddings, modelUsed: embeddingModel }
    } catch (error) {
      logger.error('[openai] batch embedding failed', {
        batchSize: texts.length,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Generate content with image (vision)
   */
  async generateContentWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<string> {
    const client = this.getClient()
    const startTime = Date.now()

    try {
      const visionModel = getOpenAIVisionModel()

      const response = await client.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      })

      const text = response.choices[0]?.message?.content || ''
      const elapsed = Date.now() - startTime

      logger.log('[openai] vision content generated', {
        model: visionModel,
        promptLength: prompt.length,
        responseLength: text.length,
        elapsedMs: elapsed,
      })

      return text
    } catch (error) {
      logger.error('[openai] vision generation failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startTime,
      })
      throw error
    }
  }
}

export const openaiService = new OpenAIService()
