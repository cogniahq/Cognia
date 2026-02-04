import { logger } from './logger.util'

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

interface ApiError {
  status?: number
  message?: string
  details?: Array<{ retryDelay?: string }>
}

/**
 * Check if an error is a rate limit (429) error
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const apiError = error as ApiError
  return apiError.status === 429
}

/**
 * Extract retry delay from error if available (e.g., from Gemini API)
 */
export function extractRetryDelayFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const apiError = error as ApiError

  // Check for retryDelay in details array (Gemini format)
  const details = apiError.details
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d?.retryDelay === 'string') {
        const match = d.retryDelay.match(/^(\d+)(?:\.(\d+))?s$/)
        if (match) {
          const seconds = Number(match[1])
          const frac = match[2] ? Number(`0.${match[2]}`) : 0
          return Math.max(Math.floor((seconds + frac) * 1000), 1000)
        }
      }
    }
  }

  // Check for "retry in Xs" in message
  const msg = apiError.message
  if (msg) {
    const match = msg.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i)
    if (match) {
      return Math.max(Math.floor(parseFloat(match[1]) * 1000), 1000)
    }
  }

  return null
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  // Add jitter (0-25% of delay)
  const jitter = exponentialDelay * Math.random() * 0.25
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

/**
 * Retry a function with exponential backoff
 * Particularly useful for handling 429 rate limit errors
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    shouldRetry = isRateLimitError,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error
      }

      // Calculate delay - use API-provided delay if available, otherwise exponential backoff
      let delayMs = extractRetryDelayFromError(error)
      if (delayMs === null) {
        delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)
      }

      // Log and notify
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs)
      }

      // Wait before retrying
      await sleep(delayMs)
    }
  }

  // This shouldn't be reached, but TypeScript needs it
  throw lastError
}

/**
 * Default retry handler for AI operations
 * Logs the retry attempt and handles 429s specifically
 */
export function createAIRetryOptions(operationName: string): RetryOptions {
  return {
    maxRetries: 4,
    baseDelayMs: 3000,
    maxDelayMs: 60000,
    shouldRetry: (error) => {
      // Retry on rate limit errors
      if (isRateLimitError(error)) return true
      // Also retry on certain other transient errors
      if (error && typeof error === 'object') {
        const status = (error as ApiError).status
        // Retry on 503 (service unavailable) and 502 (bad gateway)
        if (status === 503 || status === 502) return true
      }
      return false
    },
    onRetry: (error, attempt, delayMs) => {
      const status = (error as ApiError)?.status
      logger.warn(`${operationName} failed with status ${status}, retrying (attempt ${attempt})`, {
        delayMs,
        status,
      })
    },
  }
}
