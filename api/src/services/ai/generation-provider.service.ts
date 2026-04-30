import fetch from 'node-fetch'
import { geminiService } from './gemini.service'
import { openaiService } from './openai.service'
import { tokenTracking } from '../core/token-tracking.service'
import { retryWithBackoff, isRateLimitError, sleep } from '../../utils/core/retry.util'
import { logger } from '../../utils/core/logger.util'
import {
  getGenerationProvider,
  getOllamaBaseUrl,
  getOllamaGenerationModel,
  isOpenAISearchOnlyModeEnabled,
} from './ai-config'

interface ApiError {
  status?: number
  message?: string
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return String((error as ApiError).message || '').toLowerCase()
}

function isUnrecoverableGenerationRateLimit(error: unknown): boolean {
  if (!isRateLimitError(error)) {
    return false
  }

  const message = getErrorMessage(error)

  return (
    message.includes('requests per day') ||
    message.includes('(rpd)') ||
    message.includes('request too large') ||
    (message.includes('tokens per min') && message.includes('requested'))
  )
}

export function shouldRetryGenerationError(error: unknown): boolean {
  if (isRateLimitError(error)) {
    return !isUnrecoverableGenerationRateLimit(error)
  }

  const status = (error as ApiError)?.status
  return status === 503 || status === 502
}

function shouldReserveOpenAIForSearch(isSearchRequest: boolean, isEmailDraft: boolean): boolean {
  return isOpenAISearchOnlyModeEnabled() && !isSearchRequest && !isEmailDraft
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
    const genProvider = getGenerationProvider()

    if (shouldReserveOpenAIForSearch(isSearchRequest, isEmailDraft)) {
      const error = new Error(
        'OpenAI generation is reserved for search and email draft requests while OPENAI_SEARCH_ONLY_MODE is enabled.'
      ) as Error & { status?: number }
      error.status = 503
      throw error
    }

    if (genProvider === 'openai' || genProvider === 'hybrid') {
      try {
        const response = await retryWithBackoff(
          async () => {
            return openaiService.generateContent(prompt, isSearchRequest, timeoutOverride)
          },
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            shouldRetry: shouldRetryGenerationError,
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
      } catch (error) {
        if (genProvider !== 'hybrid') {
          throw error
        }

        logger.warn('[generation-provider] OpenAI generation failed in hybrid mode, falling back', {
          error: error instanceof Error ? error.message : String(error),
        })
        result = await this.generateWithOllama(prompt)
        modelUsed = getOllamaGenerationModel()
      }
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
      modelUsed = getOllamaGenerationModel()
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
    const ollamaBase = getOllamaBaseUrl()
    const ollamaModel = getOllamaGenerationModel()

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${ollamaBase}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
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
