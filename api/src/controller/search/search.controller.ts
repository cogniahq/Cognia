import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { OrganizationRequest } from '../../middleware/organization.middleware'
import AppError from '../../utils/http/app-error.util'
import { searchMemories } from '../../services/memory/memory-search.service'
import { createSearchJob, getSearchJob } from '../../services/search/search-job.service'
import { unifiedSearchService } from '../../services/search/unified-search.service'
import { auditLogService } from '../../services/core/audit-log.service'
import { logger } from '../../utils/core/logger.util'
import { MemorySearchController } from './memory-search.controller'
import { SearchEndpointsController } from './search-endpoints.controller'
import { SourceType } from '@prisma/client'

export class SearchController {
  // Main search endpoints
  static async postSearch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    let job: { id: string } | null = null
    try {
      const { query, limit, contextOnly, policy, embeddingOnly } = req.body || {}
      if (!query) return next(new AppError('query is required', 400))

      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const userId = req.user.id
      const embeddingOnlyBool = Boolean(embeddingOnly)

      logger.log('[search/controller] request received', {
        ts: new Date().toISOString(),
        userId: userId,
        query: query.slice(0, 100),
        limit,
        contextOnly,
        embeddingOnly: embeddingOnlyBool,
      })

      const data = await searchMemories({
        userId: userId,
        query,
        limit,
        contextOnly,
        embeddingOnly: embeddingOnlyBool,
        jobId: undefined,
        policy,
      })

      auditLogService
        .logMemorySearch(userId, query, data.results.length, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        })
        .catch(err => {
          logger.warn('[search/controller] audit_log_failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })

      if (!contextOnly && !embeddingOnly && !data.answer) {
        try {
          job = await createSearchJob()
        } catch (jobError) {
          job = null
          logger.warn('[search/controller] createSearchJob_failed', {
            error: jobError instanceof Error ? jobError.message : String(jobError),
          })
        }
      }

      const response: {
        query: string
        results: Array<{
          memory_id: string
          title: string | null
          content_preview: string
          url: string | null
          timestamp: number
          related_memories: string[]
          score: number
        }>
        answer?: string
        context?: string
        contextBlocks?: unknown[]
        citations?: Array<{
          label: number
          memory_id: string
          title: string | null
          url: string | null
        }>
        status?: string
        job_id?: string
        policy?: string
      } = {
        query: data.query,
        results: data.results,
        answer: data.answer,
        citations: data.citations,
        context: data.context,
        contextBlocks: data.contextBlocks,
        policy: data.policy,
      }

      if (job && !data.answer) {
        response.job_id = job.id
      }

      res.status(200).json(response)
    } catch (err) {
      logger.error('Error in postSearch:', err)
      next(err)
    }
  }

  static async getSearchJobStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string }
      if (!id) return next(new AppError('job id required', 400))
      const job = await getSearchJob(id)
      if (!job) return next(new AppError('job not found', 404))
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.set('Pragma', 'no-cache')
      res.set('Expires', '0')
      res.set('Surrogate-Control', 'no-store')
      res.set('ETag', `${Date.now()}`)
      res.status(200).json(job)
    } catch (err) {
      next(err)
    }
  }

  /**
   * SSE endpoint for streaming job updates
   * GET /api/search/job/:id/stream
   * Note: Auth token passed as query param since EventSource doesn't support headers
   */
  static async streamSearchJob(req: Request, res: Response) {
    const { id } = req.params as { id: string }

    if (!id) {
      res.status(400).json({ error: 'job id required' })
      return
    }

    logger.log('[search] SSE stream requested', { jobId: id })

    // Set CORS headers for direct browser connection
    const origin = req.headers.origin || 'http://localhost:5173'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
    res.flushHeaders()

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ jobId: id })}\n\n`)

    let checkCount = 0
    const maxChecks = 600 // 10 minutes max (checking every second)

    const checkInterval = setInterval(async () => {
      checkCount++

      try {
        const job = await getSearchJob(id)

        if (!job) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`)
          clearInterval(checkInterval)
          res.end()
          return
        }

        if (job.status === 'completed') {
          res.write(`event: completed\ndata: ${JSON.stringify(job)}\n\n`)
          clearInterval(checkInterval)
          res.end()
          return
        }

        if (job.status === 'failed') {
          res.write(`event: failed\ndata: ${JSON.stringify({ error: 'Answer generation failed' })}\n\n`)
          clearInterval(checkInterval)
          res.end()
          return
        }

        // Send heartbeat every 5 seconds to keep connection alive and show progress
        if (checkCount % 5 === 0) {
          res.write(`event: heartbeat\ndata: ${JSON.stringify({ status: 'pending', elapsed: checkCount })}\n\n`)
        }

        // Timeout after max checks
        if (checkCount >= maxChecks) {
          res.write(`event: timeout\ndata: ${JSON.stringify({ error: 'Answer generation timed out' })}\n\n`)
          clearInterval(checkInterval)
          res.end()
          return
        }
      } catch (error) {
        logger.error('[search] SSE check error', { jobId: id, error })
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Internal error' })}\n\n`)
        clearInterval(checkInterval)
        res.end()
      }
    }, 1000) // Check every second

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(checkInterval)
      logger.log('[search] SSE client disconnected', { jobId: id })
    })
  }

  static async getContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { query, limit } = req.body || {}
      if (!query) return next(new AppError('query is required', 400))

      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const userId = req.user.id
      const data = await searchMemories({ userId: userId, query, limit, contextOnly: true })

      res.status(200).json({
        query: data.query,
        context: data.context || 'No relevant memories found.',
        contextBlocks: data.contextBlocks || [],
        resultCount: data.results.length,
        policy: data.policy,
      })
    } catch (err) {
      next(err)
    }
  }

  // Memory search endpoints (from memory-search controller)
  static async searchMemories(req: AuthenticatedRequest, res: Response) {
    return MemorySearchController.searchMemories(req, res)
  }

  static async searchMemoriesWithEmbeddings(req: AuthenticatedRequest, res: Response) {
    return MemorySearchController.searchMemoriesWithEmbeddings(req, res)
  }

  static async searchMemoriesHybrid(req: AuthenticatedRequest, res: Response) {
    return MemorySearchController.searchMemoriesHybrid(req, res)
  }

  // Search endpoints (from search-endpoints controller)
  static async searchMemoriesEndpoint(req: AuthenticatedRequest, res: Response) {
    return SearchEndpointsController.searchMemories(req, res)
  }

  static async searchMemoriesWithEmbeddingsEndpoint(req: AuthenticatedRequest, res: Response) {
    return SearchEndpointsController.searchMemoriesWithEmbeddings(req, res)
  }

  static async searchMemoriesHybridEndpoint(req: AuthenticatedRequest, res: Response) {
    return SearchEndpointsController.searchMemoriesHybrid(req, res)
  }

  /**
   * Search organization documents and memories
   * POST /api/search/organization/:slug
   */
  static async searchOrganization(
    req: OrganizationRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { query, limit, sourceTypes, includeAnswer } = req.body || {}

      if (!query) {
        return next(new AppError('query is required', 400))
      }

      if (!req.organization) {
        return next(new AppError('Organization context required', 400))
      }

      // Parse source types if provided
      let parsedSourceTypes: SourceType[] | undefined
      if (sourceTypes) {
        if (Array.isArray(sourceTypes)) {
          parsedSourceTypes = sourceTypes.filter(
            (t): t is SourceType => Object.values(SourceType).includes(t)
          )
        }
      }

      const result = await unifiedSearchService.search({
        organizationId: req.organization.id,
        query,
        sourceTypes: parsedSourceTypes,
        limit: limit || 20,
        includeAnswer: includeAnswer !== false,
      })

      // Check if response was already sent (e.g., by timeout handler)
      if (res.headersSent) {
        logger.warn('[search] organization search completed but response already sent', {
          organizationId: req.organization.id,
          query: query.substring(0, 50),
        })
        return
      }

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      // Check if response was already sent before trying to send error
      if (res.headersSent) {
        logger.warn('[search] organization search error but response already sent', {
          error: error instanceof Error ? error.message : String(error),
          organizationId: req.organization?.id,
        })
        return
      }

      logger.error('[search] organization search failed', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Search failed', 500))
    }
  }

  /**
   * Search organization documents only
   * POST /api/search/organization/:slug/documents
   */
  static async searchOrganizationDocuments(
    req: OrganizationRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { query, limit } = req.body || {}

      if (!query) {
        return next(new AppError('query is required', 400))
      }

      if (!req.organization) {
        return next(new AppError('Organization context required', 400))
      }

      const result = await unifiedSearchService.searchDocuments(
        req.organization.id,
        query,
        limit || 20
      )

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error('[search] organization document search failed', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: req.organization?.id,
      })
      next(new AppError('Search failed', 500))
    }
  }
}
