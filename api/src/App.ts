import express, { Request, Response, NextFunction } from 'express'

import morgan from 'morgan'

import cors from 'cors'

import compression from 'compression'

import cookieParser from 'cookie-parser'

import http from 'http'

import dotenv from 'dotenv'

import globalErrorHandler from './controller/utils/global-error.controller'

import { routes } from './routes/index.route'
import { prisma } from './lib/prisma.lib'
import { startContentWorker } from './workers/content-worker'
import { startCyclicProfileWorker } from './workers/profile-worker'
import { startDocumentWorker } from './workers/document-worker'
import { ensureCollection } from './lib/qdrant.lib'
import { aiProvider } from './services/ai/ai-provider.service'
import { logger } from './utils/core/logger.util'
import { getMorganOutputMode } from './utils/core/env.util'

dotenv.config()

const app = express()
app.set('trust proxy', 1)
app.use(cookieParser())

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'cognia-api',
    uptime: Number(process.uptime().toFixed(3)),
    timestamp: new Date().toISOString(),
  })
})

const server = http.createServer(app)

const port = process.env.PORT || 3000

process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...')
  logger.error(err.name, err.message)
  process.exit(1)
})
morgan.token('timestamp', () => {
  return new Date().toISOString().replace('Z', '')
})

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const shouldUseColors = process.stdout.isTTY && process.env.NO_COLOR !== '1'

const getMethodColor = (method: string): string => {
  if (!shouldUseColors) return ''
  switch (method) {
    case 'GET':
      return colors.green
    case 'POST':
      return colors.blue
    case 'PUT':
      return colors.yellow
    case 'PATCH':
      return colors.magenta
    case 'DELETE':
      return colors.red
    default:
      return colors.cyan
  }
}

const getStatusColor = (status: number): string => {
  if (!shouldUseColors) return ''
  if (status >= 500) return colors.red
  if (status >= 400) return colors.yellow
  if (status >= 300) return colors.cyan
  if (status >= 200) return colors.green
  return colors.reset
}

const padColumn = (value: string | number | undefined | null, width: number): string => {
  const str = value === undefined || value === null || value === '' ? '-' : String(value)
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length)
}

const formatDuration = (value: string | undefined, width: number): string => {
  if (!value) return padColumn('-', width)
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return padColumn('-', width)
  return padColumn(`${numeric.toFixed(3)} ms`, width)
}

const formatSize = (value: string | undefined | null, width: number): string => {
  if (!value || value === '-' || value === '0') return padColumn('-', width)
  return padColumn(`${value} B`, width)
}

const mapOutcome = (status: number): string => {
  if (status >= 500) return 'Fail'
  if (status >= 400) return 'Warn'
  if (status >= 200) return 'OK'
  if (status === 304) return 'Skip'
  return '-'
}

const coloredMorganFormat = (tokens: morgan.TokenIndexer, req: Request, res: Response): string => {
  const method = tokens.method(req, res)
  const statusRaw = tokens.status(req, res)
  const status = Number(statusRaw ?? 0)
  const url = tokens.url(req, res)
  const responseTime = tokens['response-time'](req, res)
  const contentLength = tokens.res(req, res, 'content-length')
  const timestamp = tokens.timestamp(req, res)

  const timestampBase = `[${timestamp}]`
  const methodColumn = padColumn(method, 8)
  const statusColumn = padColumn(statusRaw ?? '-', 6)
  const durationColumn = formatDuration(responseTime, 12)
  const sizeColumn = formatSize(contentLength, 10)
  const outcomeColumn = padColumn(mapOutcome(status), 6)

  if (!shouldUseColors) {
    return `${timestampBase}  ${methodColumn}${statusColumn}${durationColumn}${sizeColumn}${outcomeColumn}${url}`
  }

  const timestampColored = `${colors.dim}${colors.gray}${timestampBase}${colors.reset}`
  const methodColored = `${getMethodColor(method)}${methodColumn}${colors.reset}`
  const statusColored = `${getStatusColor(status)}${statusColumn}${colors.reset}`
  const durationColored = `${colors.cyan}${durationColumn}${colors.reset}`
  const sizeColored = `${colors.magenta}${sizeColumn}${colors.reset}`
  const outcomeColor =
    status >= 500
      ? colors.red
      : status >= 400
        ? colors.yellow
        : status === 304
          ? colors.blue
          : colors.green
  const outcomeColored = `${outcomeColor}${outcomeColumn}${colors.reset}`

  return `${timestampColored}  ${methodColored}${statusColored}${durationColored}${sizeColored}${outcomeColored}${url}`
}

const plainMorganFormat = (tokens: morgan.TokenIndexer, req: Request, res: Response): string => {
  const method = tokens.method(req, res)
  const statusRaw = tokens.status(req, res)
  const status = Number(statusRaw ?? 0)
  const url = tokens.url(req, res)
  const responseTime = tokens['response-time'](req, res)
  const contentLength = tokens.res(req, res, 'content-length')
  const timestamp = tokens.timestamp(req, res)

  const timestampBase = `[${timestamp}]`
  const methodColumn = padColumn(method, 8)
  const statusColumn = padColumn(statusRaw ?? '-', 6)
  const durationColumn = formatDuration(responseTime, 12)
  const sizeColumn = formatSize(contentLength, 10)
  const outcomeColumn = padColumn(mapOutcome(status), 6)

  return `${timestampBase}  ${methodColumn}${statusColumn}${durationColumn}${sizeColumn}${outcomeColumn}${url}\n`
}

const morganOutputMode = getMorganOutputMode()

const morganFileStream = {
  write: (message: string) => {
    logger.writeToFile(message)
  },
}

if (morganOutputMode === 'print' || morganOutputMode === 'both') {
  app.use(morgan(coloredMorganFormat))
}

if (morganOutputMode === 'log' || morganOutputMode === 'both') {
  app.use(morgan(plainMorganFormat, { stream: morganFileStream }))
}
app.use(express.urlencoded({ extended: false, limit: '10mb' }))
app.use(express.json({ limit: '10mb' }))
import { getAllowedOrigins } from './utils/core/env.util'
import { validateRequestSize } from './utils/validation/validation.util'

app.use(validateRequestSize(10 * 1024 * 1024)) // 10MB limit

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 60000) // 60 seconds default
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 360000) // 6 minutes for search requests
const EMAIL_DRAFT_TIMEOUT_MS = Number(process.env.EMAIL_DRAFT_TIMEOUT_MS || 360000) // 6 minutes for email drafts (allows for queue delays)

app.use((req: Request, res: Response, next: NextFunction) => {
  // Check for any search-related endpoints
  const isSearchRequest =
    (req.path === '/api/search' && req.method === 'POST') ||
    (req.path.startsWith('/api/search/organization/') && req.method === 'POST')
  const isEmailDraftRequest = req.path === '/api/content/email/draft' && req.method === 'POST'
  const timeoutMs = isSearchRequest
    ? SEARCH_TIMEOUT_MS
    : isEmailDraftRequest
      ? EMAIL_DRAFT_TIMEOUT_MS
      : REQUEST_TIMEOUT_MS

  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process',
      })
    }
  }, timeoutMs)

  res.on('finish', () => {
    clearTimeout(timeout)
  })

  res.on('close', () => {
    clearTimeout(timeout)
  })

  next()
})

app.use(
  cors({
    origin: (origin, callback) => {
      const allowlist = getAllowedOrigins()
      if (!origin) return callback(null, true)
      if (allowlist.has(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
)
app.use(compression())
routes(app)
app.use(
  globalErrorHandler as unknown as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => void
)

async function testDatabaseConnection() {
  try {
    await prisma.$connect()
  } catch (error) {
    logger.error('Database connection failed:', error)
    process.exit(1)
  }
}

server.listen(port, async () => {
  const protocol = 'http'
  await testDatabaseConnection()
  logger.log('[startup] database_connected')
  try {
    await ensureCollection()
    logger.log('[startup] qdrant_ready')
  } catch (e) {
    logger.warn('[startup] qdrant_unavailable', String((e as Error)?.message || e))
  }
  const aiReady = aiProvider.isInitialized
  logger.log('[startup] ai_provider', { initialized: aiReady })
  startContentWorker()
  logger.log('[startup] content_worker_started')
  startCyclicProfileWorker()
  logger.log('[startup] profile_worker_started')
  startDocumentWorker()
  logger.log('[startup] document_worker_started')
  logger.log('[startup] server_listening', { protocol, port })
})
process.on('unhandledRejection', (err: Error) => {
  const errorMessage = err?.message || String(err) || ''
  if (errorMessage.includes('Command timed out') || errorMessage.includes('timeout')) {
    return
  }
  logger.error('Unhandled Rejection! 💥 Shutting down...')
  logger.error(err.name, err.message)
  server.close(() => {
    process.exit(1)
  })
})
