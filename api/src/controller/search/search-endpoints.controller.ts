import { Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'
import { searchMemories } from '../../services/memory/memory-search.service'
import { memoryMeshService } from '../../services/memory/memory-mesh.service'
import { logger } from '../../utils/core/logger.util'
import { Prisma } from '@prisma/client'
import { RetrievalPolicyName } from '../../services/search/retrieval-policy.service'

type MemoryWithMetadata = {
  memory: {
    id: string
    title: string | null
    url: string | null
    content: string
    timestamp: bigint
    page_metadata: Prisma.JsonValue
  }
  similarity: number
  similarity_score?: number
}

type MemoryRecord = {
  id: string
  title: string | null
  url: string | null
  content: string
  page_metadata: Prisma.JsonValue
}

const VALID_POLICIES: RetrievalPolicyName[] = ['chat', 'planning', 'profile', 'summarization']

function isValidPolicy(policy: unknown): policy is RetrievalPolicyName {
  return typeof policy === 'string' && VALID_POLICIES.includes(policy as RetrievalPolicyName)
}

export class SearchEndpointsController {
  static async searchMemories(req: AuthenticatedRequest, res: Response) {
    try {
      const { query, limit = 20, policy } = req.query

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const apiKeyId = req.apiKey?.memoryIsolation ? req.apiKey.id : undefined
      const searchResults = await searchMemories({
        userId: user.id,
        apiKeyId,
        query: query as string,
        limit: parseInt(limit as string),
        enableReasoning: true,
        contextOnly: false,
        policy: isValidPolicy(policy) ? policy : undefined,
      })

      const memories = searchResults.results.map(result => ({
        id: result.memory_id,
        title: result.title,
        url: result.url,
        timestamp: result.timestamp,
        content: result.content_preview,
        source: 'browser',
        user_id: user.id,
        created_at: new Date(result.timestamp * 1000).toISOString(),
        page_metadata: {
          topics: [] as string[],
          categories: ['web_page'],
          sentiment: 'neutral',
          importance: 5,
        },
      }))

      res.status(200).json({
        success: true,
        data: {
          total: memories.length,
          results: memories.map(memory => ({
            memory,
            search_type: 'semantic',
            semantic_score: searchResults.results.find(r => r.memory_id === memory.id)?.score || 0,
            blended_score: searchResults.results.find(r => r.memory_id === memory.id)?.score || 0,
          })),
          query: searchResults.query,
          answer: searchResults.answer,
          citations: searchResults.citations,
          context: searchResults.context,
          contextBlocks: searchResults.contextBlocks,
          policy: searchResults.policy,
        },
      })
    } catch (error) {
      logger.error('Error searching memories:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  static async searchMemoriesWithEmbeddings(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        query,
        category,
        topic,
        sentiment,
        source,
        dateRange,
        page = 1,
        limit = 10,
      } = req.query

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const whereConditions: Prisma.MemoryWhereInput = {
        user_id: user.id,
      }

      if (source && typeof source === 'string') {
        whereConditions.source = source
      }

      if (dateRange) {
        try {
          const dateRangeObj = typeof dateRange === 'string' ? JSON.parse(dateRange) : dateRange

          if (dateRangeObj.start || dateRangeObj.end) {
            whereConditions.created_at = {}

            if (dateRangeObj.start) {
              whereConditions.created_at.gte = new Date(dateRangeObj.start)
            }

            if (dateRangeObj.end) {
              whereConditions.created_at.lte = new Date(dateRangeObj.end)
            }
          }
        } catch {
          // Ignore date range parsing errors
        }
      }

      const preFilteredMemories = await prisma.memory.findMany({
        where: whereConditions,
        select: { id: true },
      })

      const preFilteredMemoryIds = preFilteredMemories.map(m => m.id)

      const apiKeyId = req.apiKey?.memoryIsolation ? req.apiKey.id : undefined
      const searchResults = await memoryMeshService.searchMemories(
        user.id,
        query as string,
        parseInt(limit as string),
        preFilteredMemoryIds,
        apiKeyId
      )

      let filteredResults = searchResults

      if (category || topic || sentiment) {
        filteredResults = searchResults.filter((result: MemoryWithMetadata) => {
          const metadata = result.memory.page_metadata as Record<string, unknown> | null

          if (
            category &&
            metadata?.categories &&
            Array.isArray(metadata.categories) &&
            !metadata.categories.includes(category)
          ) {
            return false
          }

          if (
            topic &&
            metadata?.topics &&
            Array.isArray(metadata.topics) &&
            !metadata.topics.includes(topic)
          ) {
            return false
          }

          if (sentiment && metadata?.sentiment !== sentiment) {
            return false
          }

          return true
        })
      }

      const skip = (Number(page) - 1) * Number(limit)

      const paginatedResults = filteredResults.slice(skip, skip + Number(limit))

      const serializedResults = paginatedResults.map((result: MemoryWithMetadata) => ({
        ...result,
        memory: {
          ...result.memory,
          timestamp: result.memory.timestamp.toString(),
        },
      }))

      res.status(200).json({
        success: true,
        data: {
          query: query,
          results: serializedResults,
          totalResults: filteredResults.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(filteredResults.length / Number(limit)),
          appliedFilters: {
            category,
            topic,
            sentiment,
            source,
            dateRange,
          },
        },
      })
    } catch (error) {
      logger.error('Error searching memories with embeddings:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  static async searchMemoriesHybrid(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        query,
        category,
        topic,
        sentiment,
        source,
        dateRange,
        page = 1,
        limit = 10,
      } = req.query

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query is required',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      const whereConditions: Prisma.MemoryWhereInput = {
        user_id: user.id,
      }

      if (source && typeof source === 'string') {
        whereConditions.source = source
      }

      if (dateRange) {
        try {
          const dateRangeObj = typeof dateRange === 'string' ? JSON.parse(dateRange) : dateRange

          if (dateRangeObj.start || dateRangeObj.end) {
            whereConditions.created_at = {}

            if (dateRangeObj.start) {
              whereConditions.created_at.gte = new Date(dateRangeObj.start)
            }

            if (dateRangeObj.end) {
              whereConditions.created_at.lte = new Date(dateRangeObj.end)
            }
          }
        } catch {
          // Ignore date range parsing errors
        }
      }

      const preFilteredMemories = await prisma.memory.findMany({
        where: whereConditions,
        select: { id: true },
      })

      const preFilteredMemoryIds = preFilteredMemories.map(m => m.id)

      const queryTokens = (query as string)
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2)

      const tokenConditions = queryTokens.flatMap(token => [
        { content: { contains: token, mode: 'insensitive' as const } },
        { title: { contains: token, mode: 'insensitive' as const } },
        { url: { contains: token, mode: 'insensitive' as const } },
      ])

      const [keywordResults, semanticResults] = await Promise.all([
        prisma.memory.findMany({
          where: {
            ...whereConditions,
            OR:
              tokenConditions.length > 0
                ? tokenConditions
                : [
                    { content: { contains: query as string, mode: 'insensitive' } },
                    { title: { contains: query as string, mode: 'insensitive' } },
                    { url: { contains: query as string, mode: 'insensitive' } },
                  ],
          },
          take: parseInt(limit as string) * 2,
        }),
        memoryMeshService.searchMemories(
          user.id,
          query as string,
          parseInt(limit as string) * 2,
          preFilteredMemoryIds,
          req.apiKey?.memoryIsolation ? req.apiKey.id : undefined
        ),
      ])

      let filteredKeywordResults = keywordResults

      if (category || topic || sentiment) {
        filteredKeywordResults = keywordResults.filter((memory: MemoryRecord) => {
          const metadata = memory.page_metadata as Record<string, unknown> | null

          if (
            category &&
            metadata?.categories &&
            Array.isArray(metadata.categories) &&
            !metadata.categories.includes(category)
          ) {
            return false
          }

          if (
            topic &&
            metadata?.topics &&
            Array.isArray(metadata.topics) &&
            !metadata.topics.includes(topic)
          ) {
            return false
          }

          if (sentiment && metadata?.sentiment !== sentiment) {
            return false
          }

          return true
        })
      }

      type SearchResult = MemoryRecord & {
        keyword_score: number
        semantic_score: number
        search_type: string
        blended_score?: number
      }

      const resultMap = new Map<string, SearchResult>()

      filteredKeywordResults.forEach((memory: MemoryRecord) => {
        const keywordScore = this.calculateKeywordRelevance(memory, query as string)

        resultMap.set(memory.id, {
          ...memory,
          keyword_score: keywordScore,
          semantic_score: 0,
          search_type: 'keyword',
        })
      })

      semanticResults.forEach((memory: MemoryWithMetadata) => {
        const memoryId = memory.memory.id
        const existing = resultMap.get(memoryId)

        if (existing) {
          existing.semantic_score = memory.similarity_score || 0
          existing.search_type = 'hybrid'
          existing.blended_score = existing.keyword_score * 0.4 + existing.semantic_score * 0.6
        } else {
          resultMap.set(memoryId, {
            ...memory.memory,
            keyword_score: 0,
            semantic_score: memory.similarity_score || 0,
            search_type: 'semantic',
            blended_score: memory.similarity_score || 0,
          })
        }
      })

      resultMap.forEach(result => {
        if (result.search_type === 'keyword') {
          result.blended_score = result.keyword_score * 0.4
        }
      })

      const blendedResults = Array.from(resultMap.values()).sort(
        (a, b) => (b.blended_score || 0) - (a.blended_score || 0)
      )

      const skip = (Number(page) - 1) * Number(limit)

      const paginatedResults = blendedResults.slice(skip, skip + Number(limit))

      const serializedResults = paginatedResults.map((result: SearchResult) => ({
        ...result,
        timestamp: 'timestamp' in result && result.timestamp ? result.timestamp.toString() : null,
      }))

      res.status(200).json({
        success: true,
        data: {
          query: query,
          results: serializedResults,
          totalResults: blendedResults.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(blendedResults.length / Number(limit)),
          searchStats: {
            keywordResults: filteredKeywordResults.length,
            semanticResults: semanticResults.length,
            blendedResults: blendedResults.length,
          },
          appliedFilters: {
            category,
            topic,
            sentiment,
            source,
            dateRange,
          },
        },
      })
    } catch (error) {
      logger.error('Error in hybrid search:', error)
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  private static calculateKeywordRelevance(memory: MemoryRecord, query: string): number {
    const queryLower = query.toLowerCase()

    const queryTokens = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2)

    let score = 0
    let matchedTokens = 0

    const title = (memory.title || '').toLowerCase()
    const content = (memory.content || '').toLowerCase()

    for (const token of queryTokens) {
      const tokenRegex = new RegExp(`\\b${token}\\b`, 'gi')

      if (tokenRegex.test(title)) {
        score += 0.4
        matchedTokens++
      }

      if (tokenRegex.test(content)) {
        score += 0.5
        matchedTokens++
      }
    }

    if (queryTokens.length > 0) {
      score = score / queryTokens.length
    }

    const exactPhraseRegex = new RegExp(`\\b${this.escapeRegex(queryLower)}\\b`, 'gi')

    if (exactPhraseRegex.test(title)) {
      score += 0.2
    }

    const coverageRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0
    score = score * (1 + coverageRatio * 0.3)

    return Math.min(1, score)
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
