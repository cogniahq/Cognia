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
          job = createSearchJob()
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

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
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
