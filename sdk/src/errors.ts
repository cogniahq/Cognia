import type { CogniaError } from './types.js'

export class CogniaApiError extends Error implements CogniaError {
  status: number
  code: string
  body?: unknown
  requestId?: string | undefined

  constructor(args: {
    status: number
    code: string
    message: string
    body?: unknown
    requestId?: string | undefined
  }) {
    super(args.message)
    this.name = 'CogniaApiError'
    this.status = args.status
    this.code = args.code
    if (args.body !== undefined) this.body = args.body
    if (args.requestId !== undefined) this.requestId = args.requestId
  }
}

export class CogniaTimeoutError extends Error {
  readonly code = 'timeout'
  constructor(timeoutMs: number) {
    super(`Cognia request timed out after ${timeoutMs}ms`)
    this.name = 'CogniaTimeoutError'
  }
}

export class CogniaNetworkError extends Error {
  readonly code = 'network'
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'CogniaNetworkError'
  }
}

export function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}
