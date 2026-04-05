export function getCookieDomain(): string {
  return process.env.COOKIE_DOMAIN || '.cognia.xyz'
}

export function getSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME || 'cognia_session'
}

export function isCookieSecure(): boolean {
  if (typeof process.env.COOKIE_SECURE !== 'undefined') {
    return process.env.COOKIE_SECURE === 'true'
  }
  return true
}

export function getAllowedOrigins(): Set<string> {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || ''
  const extensionIds = (process.env.EXTENSION_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const origins = new Set<string>()
  originsEnv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(o => origins.add(o))

  extensionIds.forEach(id => {
    const origin = id.startsWith('chrome-extension://') ? id : `chrome-extension://${id}`
    origins.add(origin)
  })

  return origins
}

interface RedisConnectionOptions {
  url?: string
  host?: string
  port?: number
  username?: string
  password?: string
  commandTimeout?: number
  maxRetriesPerRequest?: number
  enableReadyCheck?: boolean
  lazyConnect?: boolean
  connectTimeout?: number
  keepAlive?: number
  retryStrategy?: (times: number) => number | null
}

export function getRedisConnection(forBullMQ: boolean = false): RedisConnectionOptions {
  const connectionOptions: RedisConnectionOptions = {}

  if (process.env.REDIS_URL) {
    connectionOptions.url = process.env.REDIS_URL
  } else {
    connectionOptions.host = process.env.REDIS_HOST || '127.0.0.1'
    connectionOptions.port = Number(process.env.REDIS_PORT || 6379)
    if (process.env.REDIS_USERNAME) {
      connectionOptions.username = process.env.REDIS_USERNAME
    }
    if (process.env.REDIS_PASSWORD) {
      connectionOptions.password = process.env.REDIS_PASSWORD
    }
  }

  // Increase command timeout to 60 seconds to handle long-running operations
  // This prevents "command timed out" errors during lock renewal and queue operations
  // Processes can take 2+ minutes, so we need sufficient timeout for individual Redis commands
  connectionOptions.commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 60000)
  // BullMQ requires maxRetriesPerRequest to be null
  connectionOptions.maxRetriesPerRequest = forBullMQ ? null : 3
  connectionOptions.enableReadyCheck = true
  connectionOptions.lazyConnect = false
  connectionOptions.connectTimeout = 10000
  connectionOptions.keepAlive = 10000
  connectionOptions.retryStrategy = (times: number) => {
    if (times > 3) {
      return null
    }
    return Math.min(times * 200, 2000)
  }

  return connectionOptions
}

function isOpenAIBackedQueue(): boolean {
  const providers = [
    process.env.GEN_PROVIDER,
    process.env.EMBED_PROVIDER,
    process.env.AI_PROVIDER,
  ]
    .map(value => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))

  return providers.some(provider => provider === 'openai' || provider === 'hybrid')
}

export function getQueueLimiter() {
  const defaultMax = isOpenAIBackedQueue() ? 1 : 10
  const max = Number(process.env.QUEUE_RATE_MAX || defaultMax)
  const duration = Number(process.env.QUEUE_RATE_DURATION_MS || 60000)
  return { max, duration } as const
}

export function getQueueConcurrency() {
  return Number(process.env.QUEUE_CONCURRENCY || 1)
}

export function getQueueStalledInterval() {
  return Number(process.env.QUEUE_STALLED_INTERVAL_MS || 300000)
}

export function getQueueMaxStalledCount() {
  return Number(process.env.QUEUE_MAX_STALLED_COUNT || 10)
}

export function getLoggerOutputMode(): 'print' | 'log' | 'both' | 'none' {
  const mode = process.env.LOGGER_OUTPUT_MODE || 'log'
  if (mode === 'print' || mode === 'log' || mode === 'both' || mode === 'none') return mode
  return 'log'
}

export function getMorganOutputMode(): 'print' | 'log' | 'both' | 'none' {
  const mode = process.env.MORGAN_OUTPUT_MODE || 'print'
  if (mode === 'print' || mode === 'log' || mode === 'both' || mode === 'none') return mode
  return 'print'
}

export function getLogFilePath(): string {
  return process.env.LOG_FILE_PATH || './logs/app.log'
}
