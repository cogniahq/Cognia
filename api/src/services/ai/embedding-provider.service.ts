import fetch from 'node-fetch'
import { geminiService } from './gemini.service'
import { openaiService } from './openai.service'
import { tokenTracking } from '../core/token-tracking.service'
import { logger } from '../../utils/core/logger.util'
import { retryWithBackoff, isRateLimitError, sleep } from '../../utils/core/retry.util'
import { getEmbedProvider, getOllamaBaseUrl, getOllamaEmbeddingModel } from './ai-config'

interface ApiError {
  status?: number
  message?: string
}

/**
 * Thrown when no embedding provider can satisfy a request. Callers should
 * surface this as a hard failure rather than silently substituting a
 * deterministic-but-meaningless vector.
 */
export class EmbeddingUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'EmbeddingUnavailableError'
  }
}

const SHOULD_RETRY = (error: unknown): boolean => {
  if (isRateLimitError(error)) return true
  const status = (error as ApiError)?.status
  if (status === 503 || status === 502 || status === 429) return true
  return false
}

export class EmbeddingProviderService {
  async generateEmbedding(text: string, userId?: string): Promise<number[]> {
    let result: number[]
    let modelUsed: string | undefined
    const embedProvider = getEmbedProvider()

    if (embedProvider === 'openai') {
      const response = await retryWithBackoff(() => openaiService.generateEmbedding(text), {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        shouldRetry: SHOULD_RETRY,
        onRetry: (error, attempt, delayMs) => {
          logger.warn(`OpenAI embedding failed, retrying (attempt ${attempt})`, {
            status: (error as ApiError)?.status,
            delayMs,
          })
        },
      })
      result = response.embedding
      modelUsed = response.modelUsed
    } else if (embedProvider === 'gemini') {
      const response = await retryWithBackoff(() => geminiService.generateEmbedding(text), {
        maxRetries: 4,
        baseDelayMs: 3000,
        maxDelayMs: 60000,
        shouldRetry: SHOULD_RETRY,
        onRetry: (error, attempt, delayMs) => {
          logger.warn(`Gemini embedding failed, retrying (attempt ${attempt})`, {
            status: (error as ApiError)?.status,
            delayMs,
          })
        },
      })
      result = response.embedding
      modelUsed = response.modelUsed
    } else if (embedProvider === 'hybrid') {
      result = await this.generateHybridEmbedding(text)
    } else {
      const ollamaEmbedModel = getOllamaEmbeddingModel()
      try {
        result = await this.tryOllamaEmbedding(text, ollamaEmbedModel)
        modelUsed = ollamaEmbedModel
      } catch (error) {
        throw new EmbeddingUnavailableError(
          `Ollama embedding provider failed for model ${ollamaEmbedModel}`,
          error
        )
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

  /**
   * Batched embedding for ingest pipelines. Falls back to per-item calls only
   * if the active provider does not support batch input.
   */
  async generateEmbeddingsBatch(texts: string[], userId?: string): Promise<number[][]> {
    if (texts.length === 0) return []

    const embedProvider = getEmbedProvider()

    if (embedProvider === 'openai' && openaiService.isInitialized) {
      const response = await retryWithBackoff(() => openaiService.generateEmbeddingsBatch(texts), {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        shouldRetry: SHOULD_RETRY,
        onRetry: (error, attempt, delayMs) => {
          logger.warn(`OpenAI batch embedding failed, retrying (attempt ${attempt})`, {
            status: (error as ApiError)?.status,
            delayMs,
            batchSize: texts.length,
          })
        },
      })

      if (userId) {
        const inputTokens = texts.reduce((sum, t) => sum + tokenTracking.estimateTokens(t), 0)
        await tokenTracking.recordTokenUsage({
          userId,
          operationType: 'generate_embedding',
          inputTokens,
          outputTokens: 0,
          modelUsed: response.modelUsed,
        })
      }

      return response.embeddings
    }

    const out: number[][] = new Array(texts.length)
    for (let i = 0; i < texts.length; i++) {
      out[i] = await this.generateEmbedding(texts[i], i === 0 ? userId : undefined)
    }
    return out
  }

  async generateHybridEmbedding(text: string): Promise<number[]> {
    if (openaiService.isInitialized) {
      try {
        const response = await retryWithBackoff(() => openaiService.generateEmbedding(text), {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          shouldRetry: SHOULD_RETRY,
        })
        return response.embedding
      } catch (error) {
        logger.warn('[embedding-provider] OpenAI failed in hybrid mode, trying Ollama', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const candidates = ['nomic-embed-text:latest', 'bge-large:latest', 'mxbai-embed-large:latest']
    let lastError: unknown
    for (const model of candidates) {
      try {
        const embedding = await this.tryOllamaEmbedding(text, model)
        if (embedding && embedding.length > 0) return embedding
      } catch (error) {
        lastError = error
      }
    }

    throw new EmbeddingUnavailableError(
      'All embedding providers (OpenAI, Ollama models) failed in hybrid mode',
      lastError
    )
  }

  async tryOllamaEmbedding(text: string, model: string, retries = 2): Promise<number[]> {
    const url = `${getOllamaBaseUrl()}/api/embeddings`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: text }),
        })

        if (!res.ok) {
          const errorText = await res.text().catch(() => '')
          throw new Error(`Ollama embeddings failed: ${res.status} - ${errorText}`)
        }

        type EmbeddingResponse = { embedding?: number[]; embeddings?: number[] }
        const data = (await res.json()) as EmbeddingResponse
        const vec: number[] = data?.embedding || data?.embeddings || []

        if (!Array.isArray(vec) || vec.length === 0) {
          throw new Error('Empty embedding array')
        }

        return vec.map((v: number | string) => Number(v) || 0)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < retries) {
          const delayMs = 1000 * Math.pow(2, attempt)
          logger.warn(`[embedding-provider] Ollama failed, retrying (attempt ${attempt + 1})`, {
            error: lastError.message,
            delayMs,
          })
          await sleep(delayMs)
        }
      }
    }

    throw lastError || new Error('Ollama embedding failed')
  }
}

export const embeddingProviderService = new EmbeddingProviderService()
