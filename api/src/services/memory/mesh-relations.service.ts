import { prisma } from '../../lib/prisma.lib'
import {
  qdrantClient,
  COLLECTION_NAME,
  ensureCollection,
  EMBEDDING_DIMENSION,
} from '../../lib/qdrant.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { buildContentPreview } from '../../utils/text/text.util'
import { Prisma, RelationType } from '@prisma/client'
import type {
  MemoryWithMetadata,
  MemoryRelation,
  RelationshipEvaluation,
  BatchData,
  CachedEvaluation,
  QdrantFilter,
} from '../../types/memory.types'

export class MeshRelationsService {
  private relationshipCache = new Map<string, CachedEvaluation>()
  private cacheExpiry = 24 * 60 * 60 * 1000

  constructor() {
    setInterval(() => this.cleanCache(), 60 * 60 * 1000)
  }

  private cleanCache(): void {
    const now = Date.now()
    for (const [key, value] of this.relationshipCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.relationshipCache.delete(key)
      }
    }
  }

  async findSemanticRelations(
    memoryId: string,
    userId: string,
    limit: number,
    findRelatedMemories: (
      memoryId: string,
      userId: string,
      limit: number
    ) => Promise<MemoryRelation[]>
  ): Promise<MemoryRelation[]> {
    return findRelatedMemories(memoryId, userId, limit)
  }

  async findTopicalRelations(
    memoryId: string,
    userId: string,
    limit: number
  ): Promise<MemoryRelation[]> {
    try {
      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory || !memory.page_metadata) {
        return []
      }

      const metadata = memory.page_metadata as Record<string, unknown> | null

      const topics = (Array.isArray(metadata?.topics) ? metadata.topics : []) as string[]
      const categories = (
        Array.isArray(metadata?.categories) ? metadata.categories : []
      ) as string[]
      const keyPoints = (Array.isArray(metadata?.keyPoints) ? metadata.keyPoints : []) as string[]
      const searchableTerms = (
        Array.isArray(metadata?.searchableTerms) ? metadata.searchableTerms : []
      ) as string[]

      if (topics.length === 0 && categories.length === 0) {
        return []
      }

      const relatedMemories = await prisma.memory.findMany({
        where: {
          user_id: userId,
          id: { not: memoryId },
          OR: [
            {
              page_metadata: {
                path: ['topics'],
                array_contains: topics,
              },
            },
            {
              page_metadata: {
                path: ['categories'],
                array_contains: categories,
              },
            },
            {
              page_metadata: {
                path: ['searchableTerms'],
                array_contains: searchableTerms,
              },
            },
          ],
        },
        take: limit * 3,
      })

      const topicalSimilarities = relatedMemories.map(relatedMemory => {
        const relatedMetadata = relatedMemory.page_metadata as Record<string, unknown> | null

        const relatedTopics = (
          Array.isArray(relatedMetadata?.topics) ? relatedMetadata.topics : []
        ) as string[]
        const relatedCategories = (
          Array.isArray(relatedMetadata?.categories) ? relatedMetadata.categories : []
        ) as string[]
        const relatedKeyPoints = (
          Array.isArray(relatedMetadata?.keyPoints) ? relatedMetadata.keyPoints : []
        ) as string[]
        const relatedSearchableTerms = (
          Array.isArray(relatedMetadata?.searchableTerms) ? relatedMetadata.searchableTerms : []
        ) as string[]

        const topicOverlap = this.calculateSetOverlap(topics, relatedTopics)
        const categoryOverlap = this.calculateSetOverlap(categories, relatedCategories)
        const keyPointOverlap = this.calculateSetOverlap(keyPoints, relatedKeyPoints)
        const searchableTermOverlap = this.calculateSetOverlap(
          searchableTerms,
          relatedSearchableTerms
        )

        const similarity =
          topicOverlap * 0.4 +
          categoryOverlap * 0.3 +
          keyPointOverlap * 0.2 +
          searchableTermOverlap * 0.1

        let urlBoost = 0
        if (memory.url && relatedMemory.url) {
          try {
            const memoryDomain = new URL(memory.url).hostname
            const relatedDomain = new URL(relatedMemory.url).hostname
            if (memoryDomain === relatedDomain) {
              urlBoost = 0.1
            }
          } catch {
            // Invalid URLs, no boost
          }
        }

        return {
          memory: relatedMemory as MemoryWithMetadata,
          similarity: Math.min(1, similarity + urlBoost),
          similarity_score: Math.min(1, similarity + urlBoost),
        }
      })

      return topicalSimilarities
        .filter(item => item.similarity_score >= 0.25)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit)
    } catch (error) {
      logger.error('Error finding topical relations:', error)
      return []
    }
  }

  async findTemporalRelations(
    memoryId: string,
    userId: string,
    limit: number
  ): Promise<MemoryRelation[]> {
    try {
      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory) {
        return []
      }

      const memoryCreatedAt = new Date(memory.created_at)

      const oneHour = 60 * 60
      const oneDay = 24 * oneHour
      const oneWeek = 7 * oneDay
      const oneMonth = 30 * oneDay

      const temporalMemories = await prisma.memory.findMany({
        where: {
          user_id: userId,
          id: { not: memoryId },
          OR: [
            {
              created_at: {
                gte: new Date(memoryCreatedAt.getTime() - oneDay * 1000),
                lte: new Date(memoryCreatedAt.getTime() + oneDay * 1000),
              },
            },
            {
              created_at: {
                gte: new Date(memoryCreatedAt.getTime() - oneWeek * 1000),
                lte: new Date(memoryCreatedAt.getTime() + oneWeek * 1000),
              },
            },
            {
              created_at: {
                gte: new Date(memoryCreatedAt.getTime() - oneMonth * 1000),
                lte: new Date(memoryCreatedAt.getTime() + oneMonth * 1000),
              },
            },
          ],
        },
        orderBy: { created_at: 'desc' },
        take: limit * 3,
      })

      const temporalSimilarities = temporalMemories.map(relatedMemory => {
        const timeDiff = Math.abs(relatedMemory.created_at.getTime() - memoryCreatedAt.getTime())

        let similarity = 0

        if (timeDiff <= oneHour * 1000) {
          similarity = 0.9 + 0.1 * (1 - timeDiff / (oneHour * 1000))
        } else if (timeDiff <= oneDay * 1000) {
          similarity = 0.7 + 0.2 * (1 - timeDiff / (oneDay * 1000))
        } else if (timeDiff <= oneWeek * 1000) {
          similarity = 0.4 + 0.3 * (1 - timeDiff / (oneWeek * 1000))
        } else if (timeDiff <= oneMonth * 1000) {
          similarity = 0.1 + 0.3 * (1 - timeDiff / (oneMonth * 1000))
        }

        return {
          memory: relatedMemory as MemoryWithMetadata,
          similarity: Math.max(0, similarity),
          similarity_score: Math.max(0, similarity),
        }
      })

      return temporalSimilarities
        .filter(item => item.similarity_score >= 0.2)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit)
    } catch (error) {
      logger.error('Error finding temporal relations:', error)
      return []
    }
  }

  async createMemoryRelations(memoryId: string, userId: string): Promise<void> {
    try {
      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`)
      }

      await ensureCollection()

      const embeddingResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: new Array(EMBEDDING_DIMENSION).fill(0),
        filter: {
          must: [{ key: 'memory_id', match: { value: memoryId } }],
        },
        limit: 1,
        with_payload: true,
        with_vector: true,
        score_threshold: 0,
      })

      const hasEmbeddings = embeddingResult.length > 0 && embeddingResult[0]?.payload
      const hasMetadata = !!memory.page_metadata
      const hasContent = !!memory.content
      if (!hasEmbeddings && !hasMetadata && !hasContent) {
        return
      }

      const findRelatedMemories = async (
        memId: string,
        uId: string,
        lim: number
      ): Promise<MemoryRelation[]> => {
        await ensureCollection()
        const mem = await prisma.memory.findUnique({ where: { id: memId } })
        if (!mem) return []

        const contentEmbeddingResult = await qdrantClient.search(COLLECTION_NAME, {
          vector: new Array(EMBEDDING_DIMENSION).fill(0),
          filter: {
            must: [
              { key: 'memory_id', match: { value: memId } },
              { key: 'embedding_type', match: { value: 'content' } },
            ],
          },
          limit: 1,
          with_payload: true,
          with_vector: true,
          score_threshold: 0,
        })

        if (!contentEmbeddingResult || contentEmbeddingResult.length === 0) {
          return []
        }

        const contentEmbeddingPoint = contentEmbeddingResult[0]
        if (!contentEmbeddingPoint.vector || !Array.isArray(contentEmbeddingPoint.vector)) {
          return []
        }

        const similarMemories = await this.findSimilarMemories(
          contentEmbeddingPoint.vector as number[],
          uId,
          memId,
          lim,
          undefined,
          mem as MemoryWithMetadata
        )

        return similarMemories
      }

      const [semanticRelations, topicalRelations, temporalRelations] = await Promise.all([
        hasEmbeddings
          ? this.findSemanticRelations(memoryId, userId, 12, findRelatedMemories)
          : Promise.resolve([]),
        this.findTopicalRelations(memoryId, userId, 8),
        this.findTemporalRelations(memoryId, userId, 5),
      ])

      const allRelations = [
        ...semanticRelations.map(r => ({ ...r, relation_type: 'semantic' })),
        ...topicalRelations.map(r => ({ ...r, relation_type: 'topical' })),
        ...temporalRelations.map(r => ({ ...r, relation_type: 'temporal' })),
      ]

      const uniqueRelations = this.deduplicateRelations(allRelations)

      let filteredRelations = await this.filterRelationsWithAI(
        memory as MemoryWithMetadata,
        uniqueRelations
      )

      if (filteredRelations.length === 0) {
        const strongest = uniqueRelations
          .filter(r => r.similarity_score >= 0.3)
          .sort((a, b) => b.similarity_score - a.similarity_score)
          .slice(0, 3)
          .map(r => ({ ...r, relation_type: r.relation_type || 'semantic' }))
        filteredRelations = strongest
      }

      await this.cleanupLowQualityRelations(memoryId)

      const relationPromises = filteredRelations.map(async relatedMemory => {
        try {
          const relatedMemoryId = relatedMemory.memory.id
          const existingRelation = await prisma.memoryRelation.findUnique({
            where: {
              memory_id_related_memory_id: {
                memory_id: memoryId,
                related_memory_id: relatedMemoryId,
              },
            },
          })

          if (!existingRelation) {
            try {
              await prisma.memoryRelation.create({
                data: {
                  memory_id: memoryId,
                  related_memory_id: relatedMemoryId,
                  similarity_score: relatedMemory.similarity_score || relatedMemory.similarity,
                  relation_type:
                    (relatedMemory.relation_type as RelationType) || RelationType.semantic,
                },
              })
            } catch (createError: unknown) {
              if (
                createError instanceof Prisma.PrismaClientKnownRequestError &&
                createError.code === 'P2002'
              ) {
                return
              }
              throw createError
            }
          } else {
            const similarityScore = relatedMemory.similarity_score || relatedMemory.similarity
            const relationType =
              (relatedMemory.relation_type as RelationType) || RelationType.semantic
            const shouldUpdate =
              similarityScore > existingRelation.similarity_score + 0.05 ||
              (similarityScore > existingRelation.similarity_score &&
                this.isMoreSpecificRelationType(relationType, existingRelation.relation_type))

            if (shouldUpdate) {
              await prisma.memoryRelation.update({
                where: { id: existingRelation.id },
                data: {
                  similarity_score: similarityScore,
                  relation_type: relationType,
                },
              })
            }
          }
        } catch (error: unknown) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return
          }
          throw error
        }
      })

      await Promise.all(relationPromises)
    } catch (error) {
      logger.error(`Error creating memory relations for ${memoryId}:`, error)
      throw error
    }
  }

  private async findSimilarMemories(
    queryVector: number[],
    userId: string,
    excludeMemoryId: string,
    limit: number,
    preFilteredMemoryIds?: string[],
    baseMemory?: MemoryWithMetadata
  ): Promise<MemoryRelation[]> {
    try {
      await ensureCollection()

      const filter: QdrantFilter = {
        must: [
          { key: 'embedding_type', match: { value: 'content' } },
          { key: 'user_id', match: { value: userId } },
        ],
        must_not: [{ key: 'memory_id', match: { value: excludeMemoryId } }],
      }

      if (preFilteredMemoryIds && preFilteredMemoryIds.length > 0) {
        const filteredIds = preFilteredMemoryIds.filter(id => id !== excludeMemoryId)
        if (filteredIds.length > 0) {
          filter.must.push({ key: 'memory_id', match: { any: filteredIds } })
        } else {
          return []
        }
      }

      const searchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryVector,
        filter,
        limit: limit * 3,
        with_payload: true,
      })

      if (!searchResult || searchResult.length === 0) {
        return []
      }

      const memoryIds = searchResult
        .map(result => result.payload?.memory_id as string)
        .filter((id): id is string => !!id && id !== excludeMemoryId)

      if (memoryIds.length === 0) {
        return []
      }

      const memories = await prisma.memory.findMany({
        where: {
          id: { in: memoryIds },
        },
      })

      const memoryMap = new Map(memories.map(m => [m.id, m]))

      const baseHost = (() => {
        try {
          return baseMemory?.url ? new URL(baseMemory.url).hostname : ''
        } catch {
          return ''
        }
      })()
      const baseIsGoogleMeet = /(^|\.)meet\.google\.com$/i.test(baseHost)
      const baseIsGitHub = /^github\.com$/i.test(baseHost)
      const baseMetadata = baseMemory?.page_metadata as Record<string, unknown> | null
      const baseTopics: string[] = (
        Array.isArray(baseMetadata?.topics) ? baseMetadata.topics : []
      ) as string[]

      const similarities = searchResult
        .map(result => {
          const memoryId = result.payload?.memory_id as string
          const memory = memoryMap.get(memoryId)
          if (!memory) return null

          let similarity = result.score || 0

          const candidateHost = (() => {
            try {
              return memory.url ? new URL(memory.url).hostname : ''
            } catch {
              return ''
            }
          })()
          const candidateIsGoogleMeet = /(^|\.)meet\.google\.com$/i.test(candidateHost)
          const candidateIsGitHub = /^github\.com$/i.test(candidateHost)
          const metadata = memory.page_metadata as Record<string, unknown> | null
          const candidateTopics: string[] = (
            Array.isArray(metadata?.topics) ? metadata.topics : []
          ) as string[]

          if ((baseIsGoogleMeet && candidateIsGitHub) || (baseIsGitHub && candidateIsGoogleMeet)) {
            similarity = Math.max(0, similarity - 0.4)
          }

          const hasFilecoin = (arr: string[]) => arr.some(t => /filecoin/i.test(t))
          const pathIncludesFilecoin = (urlStr?: string) => {
            if (!urlStr) return false
            try {
              return /filecoin/i.test(new URL(urlStr).pathname)
            } catch {
              return false
            }
          }
          if (baseIsGitHub && candidateIsGitHub) {
            if (hasFilecoin(baseTopics) && hasFilecoin(candidateTopics)) {
              similarity = Math.min(1, similarity + 0.2)
            } else if (pathIncludesFilecoin(baseMemory?.url) && pathIncludesFilecoin(memory.url)) {
              similarity = Math.min(1, similarity + 0.2)
            }
          }

          return {
            memory: memory as MemoryWithMetadata,
            similarity,
            similarity_score: similarity,
          }
        })
        .filter(
          (item): item is MemoryRelation & { similarity_score: number } =>
            item !== null && item.memory !== undefined && item.similarity_score !== undefined
        )

      return similarities
        .filter(item => item.similarity >= 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
    } catch (error) {
      logger.error('Error finding similar memories:', error)
      throw error
    }
  }

  calculateSetOverlap(setA: string[], setB: string[]): number {
    if (setA.length === 0 || setB.length === 0) return 0

    const intersection = setA.filter(item => setB.includes(item))
    const union = [...new Set([...setA, ...setB])]

    return intersection.length / union.length
  }

  async cleanupLowQualityRelations(memoryId: string): Promise<void> {
    try {
      await prisma.memoryRelation.deleteMany({
        where: {
          memory_id: memoryId,
          similarity_score: { lt: 0.3 },
        },
      })

      const relations = await prisma.memoryRelation.findMany({
        where: { memory_id: memoryId },
        orderBy: { similarity_score: 'desc' },
        skip: 10,
      })

      if (relations.length > 0) {
        await prisma.memoryRelation.deleteMany({
          where: {
            id: { in: relations.map(r => r.id) },
          },
        })
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      await prisma.memoryRelation.deleteMany({
        where: {
          memory_id: memoryId,
          similarity_score: { lt: 0.4 },
          created_at: { lt: thirtyDaysAgo },
        },
      })
    } catch (error) {
      logger.error('Error cleaning up low quality relations:', error)
    }
  }

  isMoreSpecificRelationType(newType: string, existingType: string): boolean {
    const typeHierarchy: Record<string, number> = {
      semantic: 3,
      topical: 2,
      temporal: 1,
    }

    return (typeHierarchy[newType] || 0) > (typeHierarchy[existingType] || 0)
  }

  async filterRelationsWithAI(
    memory: MemoryWithMetadata,
    relations: MemoryRelation[]
  ): Promise<MemoryRelation[]> {
    try {
      const highConfidenceRelations = relations.filter(r => r.similarity_score >= 0.7)
      const mediumConfidenceRelations = relations.filter(
        r => r.similarity_score >= 0.5 && r.similarity_score < 0.7
      )
      const lowConfidenceRelations = relations.filter(
        r => r.similarity_score >= 0.4 && r.similarity_score < 0.5
      )

      const filteredRelations = [...highConfidenceRelations]

      const heuristicFiltered = this.applySmartHeuristics(memory, mediumConfidenceRelations)
      filteredRelations.push(...heuristicFiltered)

      const aiCandidates = lowConfidenceRelations
        .filter(r => this.shouldEvaluateWithAI(memory, r))
        .slice(0, 3)

      if (aiCandidates.length > 0) {
        const aiEvaluated = await this.batchEvaluateWithAI(memory, aiCandidates)
        filteredRelations.push(...aiEvaluated)
      }

      return filteredRelations.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 8)
    } catch (error) {
      logger.error('Error filtering relations with AI:', error)
      return relations
        .filter(r => r.similarity_score >= 0.6)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 6)
    }
  }

  private applySmartHeuristics(
    memory: MemoryWithMetadata,
    relations: MemoryRelation[]
  ): MemoryRelation[] {
    return relations.filter(relation => {
      const memoryMetadata = memory.page_metadata as Record<string, unknown> | null
      const relationMetadata = relation.memory.page_metadata as Record<string, unknown> | null
      const memoryTopics = (
        Array.isArray(memoryMetadata?.topics) ? memoryMetadata.topics : []
      ) as string[]
      const memoryCategories = (
        Array.isArray(memoryMetadata?.categories) ? memoryMetadata.categories : []
      ) as string[]
      const relationTopics = (
        Array.isArray(relationMetadata?.topics) ? relationMetadata.topics : []
      ) as string[]
      const relationCategories = (
        Array.isArray(relationMetadata?.categories) ? relationMetadata.categories : []
      ) as string[]

      const topicOverlap = memoryTopics.filter((topic: string) =>
        relationTopics.includes(topic)
      ).length
      const categoryOverlap = memoryCategories.filter((cat: string) =>
        relationCategories.includes(cat)
      ).length

      let domainBoost = 0
      if (memory.url && relation.memory.url) {
        try {
          const memoryDomain = new URL(memory.url).hostname
          const relationDomain = new URL(relation.memory.url).hostname
          if (memoryDomain === relationDomain) {
            domainBoost = 0.1
          }
        } catch {
          // Invalid URLs, no boost
        }
      }

      const heuristicScore =
        (topicOverlap / Math.max(memoryTopics.length, 1)) * 0.6 +
        (categoryOverlap / Math.max(memoryCategories.length, 1)) * 0.3 +
        domainBoost

      return heuristicScore >= 0.3
    })
  }

  private shouldEvaluateWithAI(memory: MemoryWithMetadata, relation: MemoryRelation): boolean {
    const memoryMetadata = memory.page_metadata as Record<string, unknown> | null
    const relationMetadata = relation.memory.page_metadata as Record<string, unknown> | null
    const memoryTopics = (
      Array.isArray(memoryMetadata?.topics) ? memoryMetadata.topics : []
    ) as string[]
    const relationTopics = (
      Array.isArray(relationMetadata?.topics) ? relationMetadata.topics : []
    ) as string[]
    const hasTopicOverlap = memoryTopics.some((topic: string) => relationTopics.includes(topic))

    const timeDiff = Math.abs(
      new Date(memory.created_at).getTime() - new Date(relation.memory.created_at).getTime()
    )
    const isRecentPair = timeDiff < 7 * 24 * 60 * 60 * 1000

    return hasTopicOverlap && isRecentPair && memoryTopics.length >= 3 && relationTopics.length >= 3
  }

  private async batchEvaluateWithAI(
    memory: MemoryWithMetadata,
    candidates: MemoryRelation[]
  ): Promise<MemoryRelation[]> {
    try {
      const memoryMetadata = memory.page_metadata as Record<string, unknown> | null
      const memoryPreview = buildContentPreview(
        memory.canonical_text || memory.content || memory.title || ''
      )
      const memoryA = {
        title: memory.title || '',
        preview: memoryPreview,
        topics: (Array.isArray(memoryMetadata?.topics) ? memoryMetadata.topics : []) as string[],
        categories: (Array.isArray(memoryMetadata?.categories)
          ? memoryMetadata.categories
          : []) as string[],
      }

      const batchData = candidates.map(candidate => {
        const candidateMetadata = candidate.memory.page_metadata as Record<string, unknown> | null
        return {
          memoryB: {
            id: candidate.memory.id,
            title: candidate.memory.title || '',
            preview: buildContentPreview(
              candidate.memory.canonical_text ||
                candidate.memory.content ||
                candidate.memory.title ||
                ''
            ),
            topics: (Array.isArray(candidateMetadata?.topics)
              ? candidateMetadata.topics
              : []) as string[],
            categories: (Array.isArray(candidateMetadata?.categories)
              ? candidateMetadata.categories
              : []) as string[],
          },
        }
      })

      const evaluations = await this.batchEvaluateRelationships(memoryA, batchData)

      return candidates
        .filter((candidate, index) => {
          const evaluation = evaluations[index]
          return evaluation && evaluation.isRelevant && evaluation.relevanceScore >= 0.3
        })
        .map((candidate, index) => ({
          ...candidate,
          similarity_score: Math.min(
            1,
            candidate.similarity_score * evaluations[index].relevanceScore
          ),
          relation_type:
            evaluations[index].relationshipType !== 'none'
              ? evaluations[index].relationshipType
              : candidate.relation_type,
        }))
    } catch (error) {
      logger.error('Error in batch AI evaluation:', error)
      return []
    }
  }

  private async batchEvaluateRelationships(
    memoryA: { title: string; preview: string; topics?: string[]; categories?: string[] },
    batchData: BatchData[]
  ): Promise<RelationshipEvaluation[]> {
    if (!aiProvider.isInitialized) {
      return batchData.map(() => ({
        isRelevant: false,
        relevanceScore: 0,
        relationshipType: 'none',
        reasoning: 'AI not available',
      }))
    }

    try {
      const results = []
      const uncachedCandidates = []
      const uncachedIndices = []

      for (let i = 0; i < batchData.length; i++) {
        const candidate = batchData[i]
        const cacheKey = this.getCacheKey(memoryA, candidate)
        const cached = this.relationshipCache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
          results[i] = cached.evaluation
        } else {
          uncachedCandidates.push(candidate)
          uncachedIndices.push(i)
        }
      }

      if (uncachedCandidates.length > 0) {
        const aiResults = await this.callAIForBatch(memoryA, uncachedCandidates)

        for (let i = 0; i < uncachedCandidates.length; i++) {
          const candidate = uncachedCandidates[i]
          const resultIndex = uncachedIndices[i]
          const evaluation = aiResults[i]

          const cacheKey = this.getCacheKey(memoryA, candidate)
          this.relationshipCache.set(cacheKey, {
            evaluation,
            timestamp: Date.now(),
          })

          results[resultIndex] = evaluation
        }
      }

      return results
    } catch (error) {
      logger.error('Error in batch relationship evaluation:', error)
      return batchData.map(() => ({
        isRelevant: false,
        relevanceScore: 0,
        relationshipType: 'none',
        reasoning: 'Evaluation failed',
      }))
    }
  }

  private getCacheKey(memoryA: { id?: string; topics?: string[] }, candidate: BatchData): string {
    const memoryAId = memoryA.id || 'unknown'
    const candidateId = candidate.memoryB.id || 'unknown'
    const memoryATopics = (memoryA.topics || []).sort().join(',')
    const candidateTopics = (candidate.memoryB.topics || []).sort().join(',')

    return `${memoryAId}:${candidateId}:${memoryATopics}:${candidateTopics}`
  }

  private async callAIForBatch(
    memoryA: { title: string; preview: string; topics?: string[]; categories?: string[] },
    batchData: BatchData[]
  ): Promise<RelationshipEvaluation[]> {
    try {
      const prompt = `Evaluate relationships between a source memory and multiple candidate memories. Return a JSON array with evaluation results.

CRITICAL: Return ONLY valid JSON. No explanations, no markdown formatting, no code blocks, no special characters. Just the JSON object.

Source Memory:
Title: ${memoryA.title || 'N/A'}
Content: ${memoryA.preview || 'N/A'}
Topics: ${memoryA.topics?.join(', ') || 'N/A'}
Categories: ${memoryA.categories?.join(', ') || 'N/A'}

Candidate Memories:
${batchData
  .map(
    (item, index) => `
${index + 1}. Memory ID: ${item.memoryB.id}
   Title: ${item.memoryB.title || 'N/A'}
   Content: ${item.memoryB.preview || 'N/A'}
   Topics: ${item.memoryB.topics?.join(', ') || 'N/A'}
   Categories: ${item.memoryB.categories?.join(', ') || 'N/A'}
`
  )
  .join('')}

Return a JSON array with one object per candidate memory:
[
  {
    "isRelevant": boolean,
    "relevanceScore": number (0-1),
    "relationshipType": string,
    "reasoning": string
  }
]

Be strict about relevance - only mark as relevant if there's substantial conceptual or topical connection.`

      const responseResult = await aiProvider.generateContent(prompt)
      const response =
        typeof responseResult === 'string'
          ? responseResult
          : typeof responseResult === 'object' && 'text' in responseResult
            ? (responseResult as { text: string }).text
            : String(responseResult)

      if (!response) {
        throw new Error('No batch evaluation generated from Gemini API')
      }

      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('Invalid JSON array response from Gemini API')
      }

      return JSON.parse(jsonMatch[0])
    } catch (error) {
      logger.error('Error in AI batch evaluation:', error)
      return batchData.map(() => ({
        isRelevant: false,
        relevanceScore: 0,
        relationshipType: 'none',
        reasoning: 'Evaluation failed',
      }))
    }
  }

  deduplicateRelations(relations: MemoryRelation[]): MemoryRelation[] {
    const seen = new Map<string, MemoryRelation>()

    return relations.filter(relation => {
      const key = relation.id
      const existingRelation = seen.get(key)

      if (existingRelation) {
        if (relation.similarity_score > existingRelation.similarity_score) {
          seen.set(key, relation)
          return true
        }
        return false
      }

      seen.set(key, relation)
      return true
    })
  }
}

export const meshRelationsService = new MeshRelationsService()
