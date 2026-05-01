import {
  CogniaApiError,
  CogniaNetworkError,
  CogniaTimeoutError,
  isRetryable,
} from './errors.js'
import type {
  ListMemoriesOptions,
  ListMemoriesResponse,
  Memory,
  MemoryResponse,
  SearchHit,
  SearchOptions,
  SearchResponse,
  UpdateMemoryInput,
} from './types.js'

export interface CogniaClientOptions {
  /** Cognia API key. Starts with `ck_live_` or `ck_test_`. */
  apiKey: string
  /** Base URL of the Cognia API. Defaults to `https://api.cognia.xyz`. */
  baseUrl?: string
  /** User-Agent header appended to the SDK identifier. */
  userAgent?: string
  /** Hard timeout for any single HTTP call in milliseconds. Default 30000. */
  timeoutMs?: number
  /** Max retry attempts on retryable errors. Default 3. */
  maxRetries?: number
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://api.cognia.xyz'
const SDK_VERSION = '0.1.0'
const SDK_USER_AGENT = `cognia-sdk-js/${SDK_VERSION}`

interface RequestOptions {
  method?: string
  path: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
  signal?: AbortSignal
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function backoffMs(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader)
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  }
  const base = Math.min(30_000, 500 * 2 ** attempt)
  const jitter = Math.random() * base * 0.2
  return base + jitter
}

export class CogniaClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly fetchImpl: typeof fetch

  readonly memories: MemoriesAPI
  readonly search: SearchAPI

  constructor(options: CogniaClientOptions) {
    if (!options.apiKey) {
      throw new Error('CogniaClient: apiKey is required')
    }
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.userAgent = options.userAgent
      ? `${SDK_USER_AGENT} ${options.userAgent}`
      : SDK_USER_AGENT
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.maxRetries = options.maxRetries ?? 3

    const provided = options.fetch
    const globalFetch =
      typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined
    if (!provided && !globalFetch) {
      throw new Error(
        'CogniaClient: no fetch implementation available. Pass `fetch` or upgrade Node to >= 18.'
      )
    }
    this.fetchImpl = provided ?? globalFetch!

    this.memories = new MemoriesAPI(this)
    this.search = new SearchAPI(this)
  }

  /** @internal */
  async request<T>(opts: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${opts.path}`)
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': this.userAgent,
      Accept: 'application/json',
    }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
      const upstreamSignal = opts.signal
      const onAbort = upstreamSignal
        ? () => ctrl.abort(upstreamSignal.reason)
        : null
      if (upstreamSignal && onAbort) {
        if (upstreamSignal.aborted) ctrl.abort(upstreamSignal.reason)
        else upstreamSignal.addEventListener('abort', onAbort, { once: true })
      }

      let response: Response
      const init: RequestInit = {
        method: opts.method ?? 'GET',
        headers,
        signal: ctrl.signal,
      }
      if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
      try {
        response = await this.fetchImpl(url, init)
      } catch (error) {
        clearTimeout(timer)
        if (upstreamSignal && onAbort) upstreamSignal.removeEventListener('abort', onAbort)
        if (ctrl.signal.aborted && !upstreamSignal?.aborted) {
          lastError = new CogniaTimeoutError(this.timeoutMs)
        } else {
          lastError = new CogniaNetworkError(
            error instanceof Error ? error.message : String(error),
            error
          )
        }
        if (attempt < this.maxRetries) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw lastError
      } finally {
        clearTimeout(timer)
        if (upstreamSignal && onAbort) upstreamSignal.removeEventListener('abort', onAbort)
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T
        return (await response.json()) as T
      }

      const requestId = response.headers.get('x-request-id') ?? undefined
      const body = await readErrorBody(response)
      const errorCode =
        (typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
          ? (body as { error: string }).error
          : undefined) ?? `http_${response.status}`
      const errorMessage =
        (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
          ? (body as { message: string }).message
          : undefined) ?? `Cognia API request failed with status ${response.status}`

      const apiError = new CogniaApiError({
        status: response.status,
        code: errorCode,
        message: errorMessage,
        body,
        requestId,
      })

      if (isRetryable(response.status) && attempt < this.maxRetries) {
        lastError = apiError
        const retryAfter = response.headers.get('retry-after')
        await sleep(backoffMs(attempt, retryAfter))
        continue
      }
      throw apiError
    }

    throw lastError instanceof Error ? lastError : new Error('Cognia request failed')
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

class MemoriesAPI {
  constructor(private readonly client: CogniaClient) {}

  /** List memories for the API key's user, paginated by opaque cursor. */
  async list(options: ListMemoriesOptions = {}): Promise<ListMemoriesResponse> {
    return this.client.request<ListMemoriesResponse>({
      path: '/v1/memories',
      query: {
        cursor: options.cursor,
        limit: options.limit,
        q: options.q,
      },
    })
  }

  /** Iterate every memory across pages, lazily. */
  async *iterate(
    options: Omit<ListMemoriesOptions, 'cursor'> = {}
  ): AsyncGenerator<Memory, void, unknown> {
    let cursor: string | null | undefined = undefined
    while (true) {
      const page = await this.list({ ...options, cursor: cursor ?? null })
      for (const memory of page.data) yield memory
      if (!page.next_cursor) return
      cursor = page.next_cursor
    }
  }

  async retrieve(id: string): Promise<Memory> {
    const out = await this.client.request<MemoryResponse>({ path: `/v1/memories/${encodeURIComponent(id)}` })
    return out.data
  }

  async update(id: string, input: UpdateMemoryInput): Promise<Memory> {
    const out = await this.client.request<MemoryResponse>({
      method: 'PATCH',
      path: `/v1/memories/${encodeURIComponent(id)}`,
      body: input,
    })
    return out.data
  }

  async delete(id: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/v1/memories/${encodeURIComponent(id)}`,
    })
  }
}

class SearchAPI {
  constructor(private readonly client: CogniaClient) {}

  /**
   * Hybrid (dense + sparse) search across the API key's tenant, with
   * cross-encoder reranking applied server-side.
   */
  async query(options: SearchOptions): Promise<SearchHit[]> {
    if (!options.query || !options.query.trim()) {
      throw new Error('CogniaClient.search: query is required')
    }
    const out = await this.client.request<SearchResponse>({
      method: 'POST',
      path: '/v1/search',
      body: {
        query: options.query,
        limit: options.limit,
      },
    })
    return out.data
  }
}
