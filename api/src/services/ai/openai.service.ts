import OpenAI from 'openai'
import { logger } from '../../utils/core/logger.util'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Models for different use cases
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini' // Fast and cheap for general use
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

class OpenAIService {
  private client: OpenAI | null = null

  get isInitialized(): boolean {
    return !!OPENAI_API_KEY
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set')
      }
      this.client = new OpenAI({ apiKey: OPENAI_API_KEY })
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
      // Use faster model for search requests
      const model = isSearchRequest ? 'gpt-4o-mini' : CHAT_MODEL

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: isSearchRequest ? 1024 : 2048,
        temperature: isSearchRequest ? 0.3 : 0.7,
      })

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

      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedText,
      })

      const embedding = response.data[0]?.embedding || []
      const elapsed = Date.now() - startTime

      logger.log('[openai] embedding generated', {
        model: EMBEDDING_MODEL,
        textLength: truncatedText.length,
        embeddingDimensions: embedding.length,
        elapsedMs: elapsed,
      })

      return { embedding, modelUsed: EMBEDDING_MODEL }
    } catch (error) {
      logger.error('[openai] embedding failed', {
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
      const response = await client.chat.completions.create({
        model: 'gpt-4o', // Vision model
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
        model: 'gpt-4o',
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
