import { prisma } from '../../lib/prisma.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { setSearchJobResult } from '../search/search-job.service'
import { profileUpdateService } from '../profile/profile-update.service'
import { logger } from '../../utils/core/logger.util'
import { getRedisClient } from '../../lib/redis.lib'
import { getRetrievalPolicy, type RetrievalPolicyName } from '../search/retrieval-policy.service'
import { buildContextFromResults, type ContextBlock } from '../search/context-builder.service'
import { queryClassificationService } from '../search/query-classification.service'
import {
  normalizeText,
  tokenizeQuery,
  analyzeQuery,
  calculateDynamicSearchParams,
  sha256Hex,
  extractCitationOrder,
} from '../search/query-processor.service'
import {
  generateQueryEmbedding,
  getEmbeddingHash,
  searchQdrant,
  withTimeout,
} from '../search/embedding-search.service'
import {
  scoreSearchResults,
  applyPolicyScoring,
  applyReranking,
  formatSearchResults,
  buildMemoryRows,
} from '../search/result-formatter.service'
import type { SearchResult } from '../../types/search.types'

const SEARCH_CACHE_PREFIX = 'search_cache:'
const SEARCH_CACHE_TTL = 5 * 60

function getCacheKey(userId: string, query: string, limit: number): string {
  const normalized = normalizeText(query)
  const hash = sha256Hex(`${userId}:${normalized}:${limit}`)
  return `${SEARCH_CACHE_PREFIX}${hash}`
}

export { withTimeout }

export async function searchMemories(params: {
  userId: string
  apiKeyId?: string | null
  query: string
  limit?: number
  enableReasoning?: boolean
  contextOnly?: boolean
  embeddingOnly?: boolean
  jobId?: string
  policy?: RetrievalPolicyName
}): Promise<{
  query: string
  results: SearchResult[]
  answer?: string
  citations?: Array<{ label: number; memory_id: string; title: string | null; url: string | null }>
  context?: string
  contextBlocks?: ContextBlock[]
  policy: RetrievalPolicyName
}> {
  const {
    userId,
    apiKeyId,
    query,
    limit,
    enableReasoning = process.env.SEARCH_ENABLE_REASONING !== 'false',
    contextOnly = false,
    embeddingOnly = false,
    jobId,
    policy,
  } = params

  const normalized = normalizeText(query)

  // Classify query to determine optimal policy if not explicitly provided
  // Skip classification for embedding-only mode to avoid delays
  let effectivePolicy = policy
  if (!policy && !embeddingOnly) {
    try {
      const classification = await queryClassificationService.classifyQuery(query, userId)
      if (classification.suggestedPolicy) {
        effectivePolicy = classification.suggestedPolicy as RetrievalPolicyName
        logger.log('[search] query_classified', {
          query: query.substring(0, 50),
          class: classification.class,
          confidence: classification.confidence,
          suggestedPolicy: effectivePolicy,
        })
      }
    } catch (error) {
      logger.warn('[search] query_classification_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      // Continue with default policy
    }
  }

  const retrievalPolicy = getRetrievalPolicy(effectivePolicy)
  const requestedLimit =
    typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : undefined
  const effectiveLimit = requestedLimit
    ? Math.min(requestedLimit, retrievalPolicy.maxResults)
    : retrievalPolicy.maxResults

  // Get user to determine memory count for dynamic search
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!user) {
    return {
      query: normalized,
      results: [],
      answer: undefined,
      citations: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  const whereClause: { user_id: string; api_key_id?: string | null } = { user_id: user.id }
  if (apiKeyId) {
    whereClause.api_key_id = apiKeyId
  } else if (apiKeyId === null) {
    whereClause.api_key_id = null
  }

  const userMemories = await prisma.memory.findMany({
    where: whereClause,
    select: { id: true },
  })

  const userMemoryIds = userMemories.map(m => m.id)

  if (userMemoryIds.length === 0) {
    logger.log('[search] no memories found for user', { ts: new Date().toISOString(), userId })
    return {
      query: normalized,
      results: [],
      answer: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  // Analyze query to determine dynamic search parameters
  const queryAnalysis = analyzeQuery(normalized, userMemoryIds.length)
  const searchParams = calculateDynamicSearchParams(
    queryAnalysis,
    userMemoryIds.length,
    effectiveLimit
  )

  logger.log('[search] processing started', {
    ts: new Date().toISOString(),
    userId,
    query: query.slice(0, 100),
    limit: searchParams.maxResults,
    enableReasoning,
    contextOnly,
    embeddingOnly,
    jobId,
    searchStrategy: searchParams.searchStrategy,
  })

  // Skip caching for contextOnly or jobId requests
  const shouldCache = !contextOnly && !embeddingOnly && !jobId
  const shouldGenerateAnswer = !contextOnly && !embeddingOnly

  if (shouldCache) {
    try {
      const cacheKey = getCacheKey(userId, query, searchParams.maxResults)
      const client = getRedisClient()
      const cached = await client.get(cacheKey)

      if (cached) {
        logger.log('[search] cache hit', {
          ts: new Date().toISOString(),
          userId,
          query: query.slice(0, 100),
        })
        return JSON.parse(cached)
      }
    } catch (error) {
      logger.warn('[search] cache read error, continuing without cache', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!aiProvider.isInitialized) {
    logger.error('AI Provider not initialized. Check GEMINI_API_KEY or AI_PROVIDER configuration.')
    throw new Error('AI Provider not configured. Set GEMINI_API_KEY or configure AI_PROVIDER.')
  }

  let embedding: number[]
  try {
    embedding = await generateQueryEmbedding(normalized, 30000)
  } catch {
    try {
      if (jobId) {
        await setSearchJobResult(jobId, { status: 'failed' })
      }
    } catch {
      // Error updating search job status
    }
    return {
      query: normalized,
      results: [],
      answer: undefined,
      citations: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  const embeddingHash = getEmbeddingHash(embedding)

  logger.log('[search] query analysis', {
    ts: new Date().toISOString(),
    userId,
    queryAnalysis,
    searchParams,
    memoryCount: userMemoryIds.length,
  })

  const qdrantSearchResult = await searchQdrant(embedding, userMemoryIds, searchParams)

  if (!qdrantSearchResult || qdrantSearchResult.length === 0) {
    return {
      query: normalized,
      results: [],
      answer: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  const searchMemoryIds = qdrantSearchResult
    .map(result => result.payload?.memory_id as string)
    .filter((id): id is string => !!id)

  if (searchMemoryIds.length === 0) {
    return {
      query: normalized,
      results: [],
      answer: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  const memories = await prisma.memory.findMany({
    where: { id: { in: searchMemoryIds } },
  })

  const scoreMap = new Map<string, number>()

  qdrantSearchResult.forEach(result => {
    const memoryId = result.payload?.memory_id as string
    if (memoryId) {
      const existingScore = scoreMap.get(memoryId)
      const newScore = result.score || 0
      if (!existingScore || newScore > existingScore) {
        scoreMap.set(memoryId, newScore)
      }
    }
  })

  const queryTokens = tokenizeQuery(normalized)
  const rows = buildMemoryRows(memories, scoreMap)
  const scoredRows = scoreSearchResults(rows, queryTokens, searchParams, queryAnalysis)
  const policyScoredRows = applyPolicyScoring(scoredRows, retrievalPolicy)
  const finalScoredRows = await applyReranking(
    policyScoredRows,
    normalized,
    user.id,
    contextOnly,
    embeddingOnly,
    shouldGenerateAnswer
  )

  logger.log('[search] results filtered and sorted', {
    ts: new Date().toISOString(),
    userId,
    filteredCount: finalScoredRows.length,
    totalScored: scoredRows.length,
    searchStrategy: searchParams.searchStrategy,
    thresholds: {
      semantic: searchParams.semanticThreshold,
      keyword: searchParams.keywordThreshold,
      coverage: searchParams.coverageThreshold,
      minScore: searchParams.minScore,
    },
  })

  const memoryIds = finalScoredRows.map(r => r.id)

  // Fast-path for embedding-only mode: return immediately after scoring
  if (embeddingOnly) {
    const results: SearchResult[] = finalScoredRows.map(r => ({
      memory_id: r.id,
      title: r.title,
      content_preview: r.content_preview,
      url: r.url,
      timestamp: Number(r.timestamp),
      related_memories: [] as string[],
      score: r.final_score,
      memory_type: r.memory_type ?? null,
      importance_score: r.importance_score,
      source: r.source,
    }))

    // Minimal query event logging
    try {
      await prisma.queryEvent.create({
        data: {
          user_id: userId,
          query: normalized,
          embedding_hash: embeddingHash,
        },
      })
    } catch {
      // Ignore database errors
    }

    return {
      query: normalized,
      results,
      answer: undefined,
      citations: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  // Fast-path: if no matches, persist minimal query event and return immediately
  if (finalScoredRows.length === 0) {
    try {
      await prisma.queryEvent.create({
        data: {
          user_id: userId,
          query: normalized,
          embedding_hash: embeddingHash,
        },
      })
    } catch {
      // Ignore database errors
    }
    return {
      query: normalized,
      results: [],
      answer: undefined,
      context: undefined,
      contextBlocks: [],
      policy: retrievalPolicy.name,
    }
  }

  // Fetch related edges for mesh context
  const relations = memoryIds.length
    ? await prisma.memoryRelation.findMany({
        where: { OR: memoryIds.map(id => ({ memory_id: id })) },
        select: { memory_id: true, related_memory_id: true },
      })
    : []

  const relatedById = new Map<string, string[]>()
  for (const id of memoryIds) relatedById.set(id, [])
  for (const rel of relations) {
    const arr = relatedById.get(rel.memory_id)
    if (arr) arr.push(rel.related_memory_id)
  }

  let answer: string | undefined
  let citations: Array<{
    label: number
    memory_id: string
    title: string | null
    url: string | null
  }> = []

  const profileContext = await profileUpdateService.getProfileContext(userId)
  const contextArtifacts = buildContextFromResults({
    items: finalScoredRows.map(row => ({
      id: row.id,
      title: row.title,
      preview: row.content_preview,
      url: row.url,
      memory_type: row.memory_type ?? null,
      importance_score: row.importance_score,
      created_at:
        row.created_at instanceof Date
          ? row.created_at
          : row.timestamp
            ? new Date(Number(row.timestamp) * 1000)
            : undefined,
    })),
    policy: retrievalPolicy,
    profileText: profileContext,
  })

  const context: string | undefined = contextArtifacts.text
  const contextBlocks = contextArtifacts.blocks

  if (shouldGenerateAnswer) {
    try {
      const bullets = finalScoredRows
        .map((r, i) => {
          const date = r.timestamp
            ? new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 10)
            : ''
          return `- [${i + 1}] ${date} ${r.content_preview || ''}`.trim()
        })
        .join('\n')

      const profileSection = profileContext ? `\n\nUser Profile Context:\n${profileContext}\n` : ''

      const ansPrompt = `You are Cognia. Answer the user's query using the evidence notes, and insert bracketed numeric citations wherever you use a note.

Rules:
- Use inline numeric citations like [1], [2].
- Keep it concise (2-4 sentences).
- Plain text only.
- Consider the user's profile context when answering to provide more relevant and personalized responses.

CRITICAL: Return ONLY plain text content. Do not use any markdown formatting including:
- No asterisks (*) for bold or italic text
- No underscores (_) for emphasis
- No backticks for code blocks
- No hash symbols (#) for headers
- No brackets [] or parentheses () for links (except numeric citations [1], [2], etc.)
- No special characters for formatting
- No bullet points with dashes or asterisks
- No numbered lists with special formatting

Return clean, readable plain text only.

User query: "${normalized}"${profileSection}
Evidence notes (ordered by relevance):
${bullets}`
      logger.log('[search] generating answer', {
        ts: new Date().toISOString(),
        userId,
        memoryCount: finalScoredRows.length,
      })
      const answerResult = await withTimeout(aiProvider.generateContent(ansPrompt, true), 300000)
      if (typeof answerResult === 'string') {
        answer = answerResult
      } else {
        const result = answerResult as { text?: string }
        answer = result.text || answerResult
      }
      logger.log('[search] answer generated', {
        ts: new Date().toISOString(),
        userId,
        answerLength: answer?.length,
      })
      const allCitations = finalScoredRows.map((r, i) => ({
        label: i + 1,
        memory_id: r.id,
        title: r.title,
        url: r.url,
      }))
      const order = extractCitationOrder(answer)
      citations =
        order.length > 0
          ? order
              .map(n => allCitations.find(c => c.label === n))
              .filter(
                (
                  c
                ): c is {
                  label: number
                  memory_id: string
                  title: string | null
                  url: string | null
                } => Boolean(c)
              )
          : []
    } catch (error) {
      logger.error('[search] error generating answer, using fallback', {
        ts: new Date().toISOString(),
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      answer = `Found ${finalScoredRows.length} relevant memories about "${normalized}". ${finalScoredRows
        .slice(0, 3)
        .map((r, i) => `[${i + 1}] ${r.title || 'Untitled'}`)
        .join(', ')}${finalScoredRows.length > 3 ? ' and more.' : '.'}`
      const fallbackCitations = finalScoredRows.map((r, i) => ({
        label: i + 1,
        memory_id: r.id,
        title: r.title,
        url: r.url,
      }))
      const order = extractCitationOrder(answer)
      citations = order
        .map(n => fallbackCitations.find(c => c.label === n))
        .filter(
          (
            c
          ): c is {
            label: number
            memory_id: string
            title: string | null
            url: string | null
          } => Boolean(c)
        )
    }
  }

  const created = await prisma.queryEvent.create({
    data: {
      user_id: userId,
      query: normalized,
      embedding_hash: embeddingHash,
    },
  })

  if (finalScoredRows.length) {
    await prisma.queryRelatedMemory.createMany({
      data: finalScoredRows.map((r, idx) => ({
        query_event_id: created.id,
        memory_id: r.id,
        rank: idx + 1,
        score: r.score,
      })),
      skipDuplicates: true,
    })
  }

  const results = formatSearchResults(finalScoredRows, relatedById)

  // If no jobId, update job synchronously; if jobId exists, it's already updated asynchronously above
  if (!jobId && answer) {
    // No job means synchronous execution, answer already generated
  } else if (jobId && !answer) {
    // Job exists but answer not generated yet - update job with initial status
    try {
      await setSearchJobResult(jobId, {
        status: 'pending',
        results: results.slice(0, 10).map(r => ({
          memory_id: r.memory_id,
          title: r.title,
          url: r.url,
          score: r.score,
        })),
      })
    } catch (error) {
      logger.error('Error updating search job initial status:', error)
    }
  }

  logger.log('[search] processing completed', {
    ts: new Date().toISOString(),
    userId,
    resultCount: results.length,
    hasAnswer: !!answer,
    hasCitations: !!citations && citations.length > 0,
    jobId,
    embeddingOnly,
  })

  const searchResult = {
    query: normalized,
    results,
    answer,
    citations,
    context,
    contextBlocks,
    policy: retrievalPolicy.name,
  }

  // Cache the results if caching is enabled
  if (shouldCache) {
    try {
      const cacheKey = getCacheKey(userId, query, searchParams.maxResults)
      const client = getRedisClient()
      await client.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(searchResult))
      logger.log('[search] cache write', {
        ts: new Date().toISOString(),
        userId,
        query: query.slice(0, 100),
      })
    } catch (error) {
      logger.warn('[search] cache write error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return searchResult
}
