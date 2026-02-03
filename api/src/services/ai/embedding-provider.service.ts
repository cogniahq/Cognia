import fetch from 'node-fetch'
import { geminiService } from './gemini.service'
import { tokenTracking } from '../core/token-tracking.service'
import { logger } from '../../utils/core/logger.util'
import { retryWithBackoff, isRateLimitError, sleep } from '../../utils/core/retry.util'

type Provider = 'gemini' | 'ollama' | 'hybrid'

const embedProvider: Provider =
  (process.env.EMBED_PROVIDER as Provider) || (process.env.AI_PROVIDER as Provider) || 'hybrid'
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text:latest'

interface ApiError {
  status?: number
  message?: string
}

export class EmbeddingProviderService {
  async generateEmbedding(text: string, userId?: string): Promise<number[]> {
    let result: number[]
    let modelUsed: string | undefined

    logger.log('[embedding-provider] generateEmbedding called', {
      embedProvider,
      textLength: text.length,
      userId,
    })

    if (embedProvider === 'gemini') {
      logger.log('[embedding-provider] Using Gemini for embeddings')
      // Use retry with exponential backoff for Gemini API calls
      const response = await retryWithBackoff(
        () => geminiService.generateEmbedding(text),
        {
          maxRetries: 4,
          baseDelayMs: 3000,
          maxDelayMs: 60000,
          shouldRetry: (error) => {
            if (isRateLimitError(error)) return true
            const status = (error as ApiError)?.status
            if (status === 503 || status === 502) return true
            return false
          },
          onRetry: (error, attempt, delayMs) => {
            const status = (error as ApiError)?.status
            logger.warn(`Gemini embedding failed with status ${status}, retrying (attempt ${attempt})`, {
              delayMs,
            })
          },
        }
      )
      result = response.embedding
      modelUsed = response.modelUsed
    } else if (embedProvider === 'hybrid') {
      logger.log('[embedding-provider] Using hybrid mode for embeddings')
      result = await this.generateHybridEmbedding(text)
    } else {
      logger.log('[embedding-provider] Using Ollama for embeddings', {
        model: OLLAMA_EMBED_MODEL,
        baseUrl: OLLAMA_BASE,
      })
      try {
        result = await this.tryOllamaEmbedding(text, OLLAMA_EMBED_MODEL)
        modelUsed = OLLAMA_EMBED_MODEL
        logger.log('[embedding-provider] Ollama embedding successful', {
          model: OLLAMA_EMBED_MODEL,
          embeddingLength: result.length,
        })
      } catch (error) {
        logger.error('[embedding-provider] Ollama embedding failed, using fallback:', error)
        result = this.generateFallbackEmbedding(text)
      }
    }

    if (userId) {
      const inputTokens = tokenTracking.estimateTokens(text)
      const outputTokens = 0
      await tokenTracking.recordTokenUsage({
        userId,
        operationType: 'generate_embedding',
        inputTokens,
        outputTokens,
        modelUsed,
      })
    }

    return result
  }

  async generateHybridEmbedding(text: string): Promise<number[]> {
    logger.log('[embedding-provider] Hybrid embedding mode - trying multiple models')
    const methods = [
      () => this.tryOllamaEmbedding(text, 'nomic-embed-text:latest'),
      () => this.tryOllamaEmbedding(text, 'bge-large:latest'),
      () => this.tryOllamaEmbedding(text, 'mxbai-embed-large:latest'),
      () => this.generateFallbackEmbedding(text),
    ]

    for (let i = 0; i < methods.length; i++) {
      try {
        logger.log('[embedding-provider] Hybrid mode - trying method', { index: i })
        const embedding = await methods[i]()
        if (embedding && embedding.length > 0) {
          logger.log('[embedding-provider] Hybrid mode - method succeeded', {
            index: i,
            embeddingLength: embedding.length,
          })
          return embedding
        }
      } catch (error) {
        logger.error('[embedding-provider] Hybrid mode - method failed:', {
          index: i,
          error,
        })
        continue
      }
    }

    logger.log('[embedding-provider] Hybrid mode - all methods failed, using fallback')
    return this.generateFallbackEmbedding(text)
  }

  async tryOllamaEmbedding(text: string, model: string, retries = 2): Promise<number[]> {
    const url = `${OLLAMA_BASE}/api/embeddings`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.log('[embedding-provider] Calling Ollama embeddings API', {
          url,
          model,
          textLength: text.length,
          textPreview: text.substring(0, 100),
          attempt,
        })

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: text }),
        })

        logger.log('[embedding-provider] Ollama API response', {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
        })

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unable to read error response')
          logger.error('[embedding-provider] Ollama API error response', {
            status: res.status,
            statusText: res.statusText,
            errorText,
          })
          throw new Error(`Ollama embeddings failed: ${res.status} - ${errorText}`)
        }

        type EmbeddingResponse = { embedding?: number[]; embeddings?: number[] }
        const data = (await res.json()) as EmbeddingResponse
        const vec: number[] = data?.embedding || data?.embeddings || []

        logger.log('[embedding-provider] Ollama embedding response parsed', {
          hasEmbedding: !!data?.embedding,
          hasEmbeddings: !!data?.embeddings,
          vectorLength: vec.length,
        })

        if (!Array.isArray(vec) || vec.length === 0) {
          throw new Error('Empty embedding array')
        }

        return vec.map((v: number | string) => Number(v) || 0)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < retries) {
          const delayMs = 1000 * Math.pow(2, attempt)
          logger.warn(`[embedding-provider] Ollama embedding failed, retrying (attempt ${attempt + 1})`, {
            error: lastError.message,
            delayMs,
          })
          await sleep(delayMs)
        }
      }
    }

    throw lastError || new Error('Ollama embedding failed')
  }

  generateFallbackEmbedding(text: string): number[] {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2)
    const embedding = new Array(768).fill(0)

    const wordHashes = words.map(word => this.simpleHash(word))
    const textHash = this.simpleHash(text)
    const semanticClusters = this.getSemanticClusters(text)

    const wordFreq = new Map<string, number>()
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    })

    for (let i = 0; i < 768; i++) {
      let value = 0

      if (i < 256 && wordHashes.length > 0) {
        const wordIndex = i % wordHashes.length
        const word = words[wordIndex]
        const freq = wordFreq.get(word) || 1
        value += Math.sin(wordHashes[wordIndex] + i) * 0.1 * Math.log(freq + 1)
      }

      if (i >= 256 && i < 512) {
        const clusterIndex = (i - 256) % semanticClusters.length
        value += Math.sin(semanticClusters[clusterIndex] + i) * 0.2
      }

      if (i >= 512) {
        const charCode = text.charCodeAt(i % text.length) || 0
        value += Math.sin(charCode + i) * 0.08
      }

      value += Math.sin(textHash + i * 7) * 0.03

      embedding[i] = value
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      for (let i = 0; i < 768; i++) {
        embedding[i] = embedding[i] / magnitude
      }
    }

    return embedding
  }

  private getSemanticClusters(text: string): number[] {
    const clusters = []
    const lowerText = text.toLowerCase()

    if (
      lowerText.includes('mac') ||
      lowerText.includes('apple') ||
      lowerText.includes('computer') ||
      lowerText.includes('laptop')
    ) {
      clusters.push(this.simpleHash('technology_computer'))
    }
    if (
      lowerText.includes('iphone') ||
      lowerText.includes('mobile') ||
      lowerText.includes('phone')
    ) {
      clusters.push(this.simpleHash('technology_mobile'))
    }
    if (
      lowerText.includes('software') ||
      lowerText.includes('app') ||
      lowerText.includes('program')
    ) {
      clusters.push(this.simpleHash('technology_software'))
    }

    if (lowerText.includes('buy') || lowerText.includes('purchase') || lowerText.includes('shop')) {
      clusters.push(this.simpleHash('action_purchase'))
    }
    if (
      lowerText.includes('learn') ||
      lowerText.includes('study') ||
      lowerText.includes('research')
    ) {
      clusters.push(this.simpleHash('action_learn'))
    }
    if (
      lowerText.includes('work') ||
      lowerText.includes('job') ||
      lowerText.includes('career') ||
      lowerText.includes('employment') ||
      lowerText.includes('hiring') ||
      lowerText.includes('positions')
    ) {
      clusters.push(this.simpleHash('action_work'))
    }
    if (
      lowerText.includes('apply') ||
      lowerText.includes('application') ||
      lowerText.includes('candidate')
    ) {
      clusters.push(this.simpleHash('action_apply'))
    }

    if (
      lowerText.includes('health') ||
      lowerText.includes('medical') ||
      lowerText.includes('doctor')
    ) {
      clusters.push(this.simpleHash('topic_health'))
    }
    if (
      lowerText.includes('travel') ||
      lowerText.includes('trip') ||
      lowerText.includes('vacation')
    ) {
      clusters.push(this.simpleHash('topic_travel'))
    }
    if (
      lowerText.includes('food') ||
      lowerText.includes('restaurant') ||
      lowerText.includes('cooking')
    ) {
      clusters.push(this.simpleHash('topic_food'))
    }

    if (lowerText.includes('cloudflare')) {
      clusters.push(this.simpleHash('company_cloudflare'))
    }
    if (lowerText.includes('apple') || lowerText.includes('mac')) {
      clusters.push(this.simpleHash('company_apple'))
    }
    if (lowerText.includes('google')) {
      clusters.push(this.simpleHash('company_google'))
    }
    if (lowerText.includes('microsoft')) {
      clusters.push(this.simpleHash('company_microsoft'))
    }

    if (clusters.length === 0) {
      clusters.push(this.simpleHash('general'))
    }

    return clusters
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }
}

export const embeddingProviderService = new EmbeddingProviderService()
