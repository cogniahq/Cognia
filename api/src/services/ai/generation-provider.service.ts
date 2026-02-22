import fetch from 'node-fetch'
import { geminiService } from './gemini.service'
import { openaiService } from './openai.service'
import { tokenTracking } from '../core/token-tracking.service'
import { retryWithBackoff, isRateLimitError, sleep } from '../../utils/core/retry.util'
import { logger } from '../../utils/core/logger.util'

type Provider = 'gemini' | 'ollama' | 'hybrid' | 'openai'

const genProvider: Provider =
  (process.env.GEN_PROVIDER as Provider) || (process.env.AI_PROVIDER as Provider) || 'hybrid'
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_GEN_MODEL = process.env.OLLAMA_GEN_MODEL || 'llama3.1:8b'

logger.log('[generation-provider] initialized', { genProvider })

interface ApiError {
  status?: number
  message?: string
}

export class GenerationProviderService {
  async generateContent(
    prompt: string,
    isSearchRequest: boolean = false,
    userId?: string,
    timeoutOverride?: number,
    isEmailDraft: boolean = false
  ): Promise<string> {
    let result: string
    let modelUsed: string | undefined

    if (genProvider === 'openai') {
      // Use OpenAI for generation (faster)
      const response = await retryWithBackoff(
        async () => {
          return openaiService.generateContent(prompt, isSearchRequest, timeoutOverride)
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          shouldRetry: error => {
            if (isRateLimitError(error)) return true
            const status = (error as ApiError)?.status
            if (status === 503 || status === 502 || status === 429) return true
            return false
          },
          onRetry: (error, attempt, delayMs) => {
            const status = (error as ApiError)?.status
            logger.warn(
              `OpenAI generation failed with status ${status}, retrying (attempt ${attempt})`,
              { delayMs, isSearchRequest }
            )
          },
        }
      )
      result = response.text
      modelUsed = response.modelUsed
    } else if (genProvider === 'gemini') {
      // Use retry with exponential backoff for Gemini API calls
      const response = await retryWithBackoff(
        async () => {
          return geminiService.generateContent(
            prompt,
            isSearchRequest,
            timeoutOverride,
            isEmailDraft
          )
        },
        {
          maxRetries: 4,
          baseDelayMs: 3000,
          maxDelayMs: 60000,
          shouldRetry: error => {
            if (isRateLimitError(error)) return true
            // Also retry on transient errors
            const status = (error as ApiError)?.status
            if (status === 503 || status === 502) return true
            return false
          },
          onRetry: (error, attempt, delayMs) => {
            const status = (error as ApiError)?.status
            logger.warn(
              `Gemini generation failed with status ${status}, retrying (attempt ${attempt})`,
              {
                delayMs,
                isSearchRequest,
              }
            )
          },
        }
      )
      result = response.text
      modelUsed = response.modelUsed
    } else {
      // Ollama with basic retry
      result = await this.generateWithOllama(prompt)
      modelUsed = OLLAMA_GEN_MODEL
    }

    if (userId) {
      const inputTokens = tokenTracking.estimateTokens(prompt)
      const outputTokens = tokenTracking.estimateTokens(result)
      await tokenTracking.recordTokenUsage({
        userId,
        operationType: isSearchRequest ? 'search' : 'generate_content',
        inputTokens,
        outputTokens,
        modelUsed,
      })
    }

    return result
  }

  private async generateWithOllama(prompt: string, retries = 2): Promise<string> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_GEN_MODEL,
            prompt,
            stream: false,
            options: { num_predict: 128, temperature: 0.3 },
          }),
        })

        if (!res.ok) {
          throw new Error(`Ollama generate failed: ${res.status}`)
        }

        type OllamaResponse = { response?: string; text?: string }
        const data = (await res.json()) as OllamaResponse
        const result = data?.response || data?.text || ''

        if (!result) {
          throw new Error('No content from Ollama')
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < retries) {
          const delayMs = 1000 * Math.pow(2, attempt)
          logger.warn(`Ollama generation failed, retrying (attempt ${attempt + 1})`, {
            error: lastError.message,
            delayMs,
          })
          await sleep(delayMs)
        }
      }
    }

    throw lastError || new Error('Ollama generation failed')
  }
}

export const generationProviderService = new GenerationProviderService()
