import { UMAP } from 'umap-js'
import { prisma } from '../../lib/prisma.lib'
import { aiProvider } from '../ai/ai-provider.service'
import {
  qdrantClient,
  COLLECTION_NAME,
  ensureCollection,
  EMBEDDING_DIMENSION,
} from '../../lib/qdrant.lib'
import { randomUUID } from 'crypto'
import { logger } from '../../utils/core/logger.util'
import { GEMINI_EMBED_MODEL } from '../ai/gemini.service'
import { buildContentPreview } from '../../utils/text/text.util'
import { meshCalculationService } from './mesh-calculation.service'
import { meshRelationsService } from './mesh-relations.service'
import { meshClusteringService } from './mesh-clustering.service'
import type {
  MemoryWithMetadata,
  MemoryRelation,
  MemoryEdge,
  QdrantFilter,
} from '../../types/memory.types'

export class MemoryMeshService {
  constructor() {
    // Ensure Qdrant collection exists on startup
    ensureCollection().catch(error => {
      logger.error('Failed to ensure Qdrant collection:', error)
    })
  }
  async generateEmbeddingsForMemory(memoryId: string): Promise<void> {
    try {
      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`)
      }

      const embeddingPromises = []

      const canonicalContent = memory.canonical_text || memory.content
      if (canonicalContent) {
        embeddingPromises.push(
          this.createEmbedding(memoryId, memory.user_id, canonicalContent, 'content')
        )
      }

      if (memory.title) {
        embeddingPromises.push(
          this.createEmbedding(memoryId, memory.user_id, memory.title, 'title')
        )
      }

      await Promise.all(embeddingPromises)
    } catch (error) {
      logger.error(`Error generating embeddings for memory ${memoryId}:`, error)
      throw error
    }
  }

  private async createEmbedding(
    memoryId: string,
    userId: string,
    text: string,
    type: string
  ): Promise<void> {
    try {
      await ensureCollection()
      const embeddingResult = await aiProvider.generateEmbedding(text)
      const embedding: number[] =
        typeof embeddingResult === 'object' && 'embedding' in embeddingResult
          ? (embeddingResult as { embedding: number[] }).embedding
          : (embeddingResult as number[])

      const pointId = randomUUID()
      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: {
              memory_id: memoryId,
              user_id: userId,
              embedding_type: type,
              model_name: GEMINI_EMBED_MODEL,
              created_at: new Date().toISOString(),
            },
          },
        ],
      })
    } catch (error) {
      logger.error(`Error creating ${type} embedding for memory ${memoryId}:`, error)
      throw error
    }
  }

  async findRelatedMemories(
    memoryId: string,
    userId: string,
    limit: number = 5
  ): Promise<MemoryRelation[]> {
    try {
      await ensureCollection()

      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      })

      if (!memory) {
        return []
      }

      const contentEmbeddingResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: new Array(EMBEDDING_DIMENSION).fill(0),
        filter: {
          must: [
            { key: 'memory_id', match: { value: memoryId } },
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
        userId,
        memoryId,
        limit,
        undefined,
        memory
      )

      return similarMemories
    } catch (error) {
      logger.error(`Error finding related memories for ${memoryId}:`, error)
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

          return { memory: memory as MemoryWithMetadata, similarity, similarity_score: similarity }
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
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0

    let normA = 0

    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  async createMemoryRelations(memoryId: string, userId: string): Promise<void> {
    return meshRelationsService.createMemoryRelations(memoryId, userId)
  }

  private pruneEdgesMutualKNN_DEPRECATED(
    edges: MemoryEdge[],
    k: number,
    similarityThreshold: number
  ): MemoryEdge[] {
    // Build adjacency lists with weighted scores
    type WeightedEdge = MemoryEdge & { weighted: number }
    const bySource = new Map<string, WeightedEdge[]>()
    const edgeMap = new Map<string, MemoryEdge>()

    const weightForType: Record<string, number> = {
      semantic: 0.05,
      topical: 0.02,
      temporal: 0,
    }

    const keyFor = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`)

    edges.forEach((e: MemoryEdge) => {
      if (e.source === e.target) return
      // Weighted score to gently prioritize semantic links
      const weighted = (e.similarity_score || 0) + (weightForType[e.relationship_type || ''] || 0)
      if (weighted < similarityThreshold) return

      if (!bySource.has(e.source)) bySource.set(e.source, [])
      if (!bySource.has(e.target)) bySource.set(e.target, [])

      bySource.get(e.source)!.push({ ...e, weighted })
      bySource.get(e.target)!.push({ ...e, source: e.target, target: e.source, weighted })

      edgeMap.set(keyFor(e.source, e.target), e)
    })

    // Keep top-k per node
    const topKPerNode = new Map<string, Set<string>>()
    for (const [node, list] of bySource.entries()) {
      const top = list
        .sort((a, b) => b.weighted - a.weighted)
        .slice(0, k)
        .map(e => e.target)
      topKPerNode.set(node, new Set(top))
    }

    // Mutual condition: A in topK(B) and B in topK(A)
    const kept = new Map<string, MemoryEdge>()
    for (const e of edges) {
      if (e.source === e.target) continue
      const aTop = topKPerNode.get(e.source)
      const bTop = topKPerNode.get(e.target)
      if (!aTop || !bTop) continue
      if (!aTop.has(e.target) || !bTop.has(e.source)) continue
      const kkey = keyFor(e.source, e.target)
      const existing = kept.get(kkey)
      if (!existing || (e.similarity_score || 0) > (existing.similarity_score || 0)) {
        kept.set(kkey, e)
      }
    }

    // Degree cap to avoid hubs
    const degreeCap = Math.max(2, Math.min(5, k + 1))
    const degree = new Map<string, number>()
    const finalEdges: MemoryEdge[] = []
    const sorted = Array.from(kept.values()).sort(
      (a, b) => (b.similarity_score || 0) - (a.similarity_score || 0)
    )

    for (const e of sorted) {
      const da = degree.get(e.source) || 0
      const db = degree.get(e.target) || 0
      if (da >= degreeCap || db >= degreeCap) continue
      finalEdges.push(e)
      degree.set(e.source, da + 1)
      degree.set(e.target, db + 1)
    }

    return finalEdges
  }

  private getSourceOffset_DEPRECATED(source: string): { x: number; y: number } {
    // Create natural clusters based on source type
    const offsets: { [key: string]: { x: number; y: number } } = {
      extension: { x: -300, y: -200 },
      github: { x: 200, y: -100 },
      meet: { x: -200, y: 300 },
      default: { x: 0, y: 0 },
    }

    return offsets[source] || offsets.default
  }

  private applyForceDirectedLayout_DEPRECATED(
    nodes: Array<{ id: string; x: number; y: number; z?: number }>,
    edges: MemoryEdge[]
  ): Array<{ id: string; x: number; y: number; z?: number }> {
    // Improved force-directed layout with non-circular constraints
    const iterations = 150
    const k = 400 // Spring constant
    const c = 0.008 // Damping factor
    const maxForce = 50 // Limit maximum force to prevent wild movements

    // Initialize forces
    const forces = new Map<string, { x: number; y: number }>()
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 })
    })

    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      forces.forEach(force => {
        force.x = 0
        force.y = 0
      })

      // Repulsive forces between all nodes (weaker to avoid circular formation)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i]
          const nodeB = nodes[j]
          const dx = nodeA.x - nodeB.x
          const dy = nodeA.y - nodeB.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1

          // Weaker repulsive force to allow more natural clustering
          const force = Math.min((k * k) / (distance * 1.5), maxForce)
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force

          forces.get(nodeA.id)!.x += fx
          forces.get(nodeA.id)!.y += fy
          forces.get(nodeB.id)!.x -= fx
          forces.get(nodeB.id)!.y -= fy
        }
      }

      // Stronger attractive forces for connected nodes
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)

        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x
          const dy = targetNode.y - sourceNode.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1

          // Stronger attractive force to pull related nodes together
          const force = Math.min((distance * distance) / (k * 0.8), maxForce)
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force

          forces.get(sourceNode.id)!.x += fx
          forces.get(sourceNode.id)!.y += fy
          forces.get(targetNode.id)!.x -= fx
          forces.get(targetNode.id)!.y -= fy
        }
      })

      // Apply forces with adaptive damping
      const adaptiveDamping = c * (1 - iter / iterations) // Reduce damping over time
      nodes.forEach(node => {
        const force = forces.get(node.id)!
        node.x += Math.max(-maxForce, Math.min(maxForce, force.x)) * adaptiveDamping
        node.y += Math.max(-maxForce, Math.min(maxForce, force.y)) * adaptiveDamping

        // Keep nodes within rectangular bounds instead of circular
        const maxX = 1200
        const maxY = 800
        node.x = Math.max(-maxX, Math.min(maxX, node.x))
        node.y = Math.max(-maxY, Math.min(maxY, node.y))
      })
    }

    return nodes
  }

  private async computeLatentSpaceProjection_DEPRECATED(
    memories: MemoryWithMetadata[]
  ): Promise<Map<string, { x: number; y: number; z: number }>> {
    try {
      await ensureCollection()

      if (memories.length < 3) {
        return new Map()
      }

      const memoryIds = memories.map(m => m.id)
      const userId = memories.length > 0 ? memories[0].user_id : undefined

      const filter: QdrantFilter = {
        must: [
          { key: 'memory_id', match: { any: memoryIds } },
          { key: 'embedding_type', match: { value: 'content' } },
        ],
      }

      if (userId) {
        filter.must.push({ key: 'user_id', match: { value: userId } })
      }

      const embeddingResult = await qdrantClient.scroll(COLLECTION_NAME, {
        filter,
        limit: memoryIds.length * 3,
        with_payload: true,
        with_vector: true,
      })

      if (!embeddingResult.points || embeddingResult.points.length < 3) {
        return new Map()
      }

      let embeddingData: { id: string; vector: number[] }[] = []
      for (const point of embeddingResult.points) {
        const memoryId = point.payload?.memory_id as string
        if (memoryId && point.vector && Array.isArray(point.vector)) {
          embeddingData.push({ id: memoryId, vector: point.vector as number[] })
        }
      }

      if (embeddingData.length < 3) {
        return new Map()
      }

      embeddingData = embeddingData.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

      const embeddingMatrix = embeddingData.map(e => e.vector)

      const makeSeed = (ids: string[]): number => {
        let h = 2166136261
        for (const id of ids) {
          for (let i = 0; i < id.length; i++) {
            h ^= id.charCodeAt(i)
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
          }
        }
        return h >>> 0
      }
      const mulberry32 = (seed: number) => () => {
        let t = (seed += 0x6d2b79f5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const seededRandom = mulberry32(makeSeed(embeddingData.map(e => e.id)))

      const datasetSize = embeddingMatrix.length
      let nEpochs = 50
      if (datasetSize > 2000) {
        nEpochs = 30
      } else if (datasetSize > 1000) {
        nEpochs = 50
      } else if (datasetSize > 500) {
        nEpochs = 75
      } else if (datasetSize > 200) {
        nEpochs = 100
      }

      const umap = new UMAP({
        nComponents: 3,
        nEpochs: nEpochs,
        nNeighbors: Math.min(10, Math.max(3, Math.floor(Math.sqrt(datasetSize)))),
        minDist: 0.1,
        spread: 1.5,
        random: seededRandom,
      })

      const projection = umap.fit(embeddingMatrix)

      let xMin = Infinity
      let xMax = -Infinity
      let yMin = Infinity
      let yMax = -Infinity
      let zMin = Infinity
      let zMax = -Infinity

      const coords = projection.map(p => {
        const x = p[0]
        const y = p[1]
        const z = p[2] ?? 0
        xMin = Math.min(xMin, x)
        xMax = Math.max(xMax, x)
        yMin = Math.min(yMin, y)
        yMax = Math.max(yMax, y)
        zMin = Math.min(zMin, z)
        zMax = Math.max(zMax, z)
        return { x, y, z }
      })

      const scale = 1200
      const xSpan = xMax - xMin || 1
      const ySpan = yMax - yMin || 1
      const zSpan = zMax - zMin || 1

      const normalized = coords.map((c: { x: number; y: number; z: number }) => ({
        x: ((c.x - xMin) / xSpan - 0.5) * scale,
        y: ((c.y - yMin) / ySpan - 0.5) * scale,
        z: ((c.z - zMin) / zSpan - 0.5) * (scale * 0.6),
      }))

      const coordMap = new Map<string, { x: number; y: number; z: number }>()
      embeddingData.forEach((data, index) => {
        coordMap.set(data.id, normalized[index])
      })

      return coordMap
    } catch (error) {
      logger.error('Error computing latent space projection:', error)
      return new Map()
    }
  }

  async getMemoryMesh(
    userId?: string,
    apiKeyId?: string | null,
    limit: number = 50,
    similarityThreshold: number = 0.4
  ): Promise<{
    nodes: Array<{ id: string; x: number; y: number; z?: number; title?: string; url?: string }>
    edges: MemoryEdge[]
  }> {
    try {
      const whereClause: { user_id?: string; api_key_id?: string | null } = userId
        ? { user_id: userId }
        : {}
      if (apiKeyId !== undefined) {
        whereClause.api_key_id = apiKeyId
      }

      const queryOptions: {
        where: { user_id?: string; api_key_id?: string | null } | Record<string, never>
        select: {
          id: boolean
          title: boolean
          url: boolean
          created_at: boolean
          source: boolean
          timestamp: boolean
          importance_score: boolean
          user_id: boolean
          content: boolean
          page_metadata: boolean
        }
        orderBy: { created_at: 'desc' }
        take?: number
      } = {
        where: whereClause,
        select: {
          id: true,
          title: true,
          url: true,
          created_at: true,
          source: true,
          timestamp: true,
          importance_score: true,
          user_id: true,
          content: true,
          page_metadata: true,
        },
        orderBy: { created_at: 'desc' },
      }

      if (limit !== Infinity && Number.isFinite(limit)) {
        queryOptions.take = limit
      }

      const memories = (await prisma.memory.findMany(queryOptions)) as MemoryWithMetadata[]

      const latentCoords = await meshCalculationService.computeLatentSpaceProjection(memories)

      const nodes = memories.map((memory, index: number) => {
        let x, y, z

        if (latentCoords.has(memory.id)) {
          const coords = latentCoords.get(memory.id)!
          x = coords.x
          y = coords.y
          z = coords.z ?? 0
        } else {
          const gridSize = Math.ceil(Math.sqrt(memories.length))
          const row = Math.floor(index / gridSize)
          const col = index % gridSize
          const jitter = (seed: string, salt: string) => {
            let h = 2166136261
            const s = seed + '|' + salt
            for (let i = 0; i < s.length; i++) {
              h ^= s.charCodeAt(i)
              h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
            }
            return ((h >>> 0) % 1000) / 1000 - 0.5
          }
          const jx = jitter(memory.id, 'x')
          const jy = jitter(memory.id, 'y')
          x = (col - gridSize / 2) * 200 + jx * 100
          y = (row - gridSize / 2) * 200 + jy * 100
          const jz = jitter(memory.id, 'z')
          z = jz * 300
        }

        const preview = buildContentPreview(
          memory.canonical_text || memory.content || memory.title || ''
        )

        return {
          id: memory.id,
          type: memory.source || 'extension',
          label: memory.title || preview.substring(0, 20) || 'Memory',
          memory_id: memory.id,
          title: memory.title,
          preview,
          url: memory.url,
          source: memory.source || 'extension',
          timestamp: memory.timestamp,
          importance_score: memory.importance_score || 0.5,
          x,
          y,
          hasEmbedding: latentCoords.has(memory.id),
          z,
          clusterId: undefined as number | undefined,
          layout: {
            isLatentSpace: latentCoords.has(memory.id),
            cluster: memory.source || 'extension',
            centrality: 0,
          },
        }
      })

      const rawEdges: MemoryEdge[] = []

      const getDomain = (url?: string | null) => {
        try {
          if (!url) return null
          const u = new URL(url)
          return u.hostname.replace(/^www\./, '')
        } catch {
          return null
        }
      }

      const nodeCount = nodes.length
      const k = Math.min(15, Math.max(5, Math.floor(Math.sqrt(Math.max(1, nodeCount)))))
      const minDegree = Math.min(5, Math.max(2, Math.floor(k / 2)))

      const nodeIdToDomain = new Map<string, string | null>(
        nodes.map(n => [n.id, getDomain(n.url)])
      )
      const nodeIdToSource = new Map<string, string | null>(
        nodes.map(n => [n.id, n.source || null])
      )
      const nodeIdToTimestamp = new Map<string, number | null>(
        nodes.map(n => [n.id, n.timestamp ? Number(n.timestamp) : null])
      )

      const nodesWithCoords = nodes.filter(n => latentCoords.has(n.id))
      if (nodesWithCoords.length === 0) {
        return {
          nodes: nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            z: n.z,
            title: n.title,
            url: n.url,
          })),
          edges: [],
        }
      }

      const gridSize = Math.ceil(Math.sqrt(nodesWithCoords.length))
      const gridCellSize = 2000 / gridSize
      const spatialGrid = new Map<
        string,
        Array<{ node: (typeof nodes)[0]; coord: { x: number; y: number; z: number } }>
      >()

      nodesWithCoords.forEach(node => {
        const coord = latentCoords.get(node.id)!
        const gridX = Math.floor((coord.x + 1000) / gridCellSize)
        const gridY = Math.floor((coord.y + 1000) / gridCellSize)
        const gridKey = `${gridX},${gridY}`

        if (!spatialGrid.has(gridKey)) {
          spatialGrid.set(gridKey, [])
        }
        spatialGrid.get(gridKey)!.push({ node, coord })
      })

      const nodeDistancesMap = new Map<string, Array<{ targetId: string; distance: number }>>()
      const allDistances: number[] = []
      const searchRadius = 2

      nodesWithCoords.forEach(node => {
        const coord = latentCoords.get(node.id)!
        const gridX = Math.floor((coord.x + 1000) / gridCellSize)
        const gridY = Math.floor((coord.y + 1000) / gridCellSize)
        const distances: Array<{ targetId: string; distance: number }> = []

        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            const checkKey = `${gridX + dx},${gridY + dy}`
            const cellNodes = spatialGrid.get(checkKey)
            if (!cellNodes) continue

            cellNodes.forEach(({ node: otherNode, coord: otherCoord }) => {
              if (node.id === otherNode.id) return

              const dx = coord.x - otherCoord.x
              const dy = coord.y - otherCoord.y
              const dz = (coord.z ?? 0) - (otherCoord.z ?? 0)
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
              distances.push({ targetId: otherNode.id, distance })
              allDistances.push(distance)
            })
          }
        }

        distances.sort((a, b) => a.distance - b.distance)
        nodeDistancesMap.set(node.id, distances)
      })

      allDistances.sort((a, b) => a - b)
      const percentile95 = Math.floor(allDistances.length * 0.95)
      const maxDistance =
        allDistances[percentile95] || (allDistances.length > 0 ? Math.max(...allDistances) : 1)

      // Second pass: calculate similarity scores
      nodes.forEach(node => {
        if (!latentCoords.has(node.id)) return

        const distances = nodeDistancesMap.get(node.id)!
        if (!distances) return

        const nearest = distances.slice(0, k)
        const chosen = nearest.length >= minDegree ? nearest : distances.slice(0, minDegree)

        chosen.forEach(({ targetId, distance }) => {
          // Use inverse distance with proper scaling - closer nodes get higher similarity
          // Normalize to 0-1 range, then apply non-linear scaling for better distribution
          const normalizedDist = Math.min(1, distance / maxDistance)
          const baseSim = Math.pow(1 - normalizedDist, 1.5)

          let boost = 0
          const srcA = nodeIdToSource.get(node.id)
          const srcB = nodeIdToSource.get(targetId)
          if (srcA && srcB && srcA === srcB) boost += 0.02

          const domA = nodeIdToDomain.get(node.id)
          const domB = nodeIdToDomain.get(targetId)
          if (domA && domB && domA === domB) boost += 0.03

          const tsA = nodeIdToTimestamp.get(node.id)
          const tsB = nodeIdToTimestamp.get(targetId)
          if (tsA && tsB) {
            const dt = Math.abs(tsA - tsB)
            if (dt <= 60 * 60) boost += 0.02
            else if (dt <= 24 * 60 * 60) boost += 0.015
            else if (dt <= 7 * 24 * 60 * 60) boost += 0.01
          }

          const similarityScore = Math.max(0, Math.min(1, baseSim + boost))
          if (similarityScore < similarityThreshold) return

          rawEdges.push({
            source: node.id,
            target: targetId,
            relationship_type: 'semantic',
            similarity_score: similarityScore,
          })
        })
      })

      const edgeMap = new Map<string, MemoryEdge>()
      rawEdges.forEach(edge => {
        const key = [edge.source, edge.target].sort().join('_')
        const existing = edgeMap.get(key)
        if (!existing || edge.similarity_score > existing.similarity_score) {
          edgeMap.set(key, edge)
        }
      })

      let edges = Array.from(edgeMap.values()).filter(
        e => e.similarity_score >= similarityThreshold
      )

      edges.sort((a, b) => b.similarity_score - a.similarity_score)

      edges = meshCalculationService.pruneEdgesMutualKNN(edges, k, similarityThreshold)

      // Ensure minimum degree by adding closest edges if needed
      const idToNeighbors = new Map<string, MemoryEdge[]>(
        nodes.map((n): [string, MemoryEdge[]] => [n.id, []])
      )
      edges.forEach(e => {
        idToNeighbors.get(e.source)!.push(e)
        idToNeighbors.get(e.target)!.push({ ...e, source: e.target, target: e.source })
      })
      nodes.forEach(n => {
        const deg = (idToNeighbors.get(n.id) || []).length
        if (deg >= minDegree || !latentCoords.has(n.id)) return
        // find closest candidates not already connected
        const nCoord = latentCoords.get(n.id)!
        const currentlyConnected = new Set((idToNeighbors.get(n.id) || []).map(e => e.target))
        const candidates = nodes
          .filter(o => o.id !== n.id && latentCoords.has(o.id) && !currentlyConnected.has(o.id))
          .map(o => {
            const oCoord = latentCoords.get(o.id)!
            const dx = nCoord.x - oCoord.x
            const dy = nCoord.y - oCoord.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const baseSim = Math.max(0, 1 - distance / maxDistance)
            return {
              source: n.id,
              target: o.id,
              distance,
              similarity_score: baseSim,
              relationship_type: 'semantic',
            }
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, minDegree - deg)
          .filter(c => c.similarity_score > similarityThreshold)
        candidates.forEach(c => edges.push(c))
      })

      const layoutNodes = nodes

      // Create clusters based on density in latent space (DBSCAN-like)
      const clusters: { [key: string]: string[] } = {}
      const clusterAssignments = new Map<string, number>()
      let nextClusterId = 0

      const visited = new Set<string>()
      const epsilon = 250
      const minPoints = 2

      layoutNodes.forEach(node => {
        if (visited.has(node.id) || !latentCoords.has(node.id)) return

        visited.add(node.id)
        const nodeCoord = latentCoords.get(node.id)!

        const neighbors: string[] = []
        const gridX = Math.floor((nodeCoord.x + 1000) / gridCellSize)
        const gridY = Math.floor((nodeCoord.y + 1000) / gridCellSize)

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const checkKey = `${gridX + dx},${gridY + dy}`
            const cellNodes = spatialGrid.get(checkKey)
            if (!cellNodes) continue

            cellNodes.forEach(({ node: otherNode, coord: otherCoord }) => {
              if (node.id === otherNode.id || visited.has(otherNode.id)) return

              const dx = nodeCoord.x - otherCoord.x
              const dy = nodeCoord.y - otherCoord.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance <= epsilon) {
                neighbors.push(otherNode.id)
              }
            })
          }
        }

        if (neighbors.length >= minPoints) {
          const clusterId = nextClusterId++
          const clusterKey = `cluster_${clusterId}`
          clusters[clusterKey] = [node.id, ...neighbors]

          clusterAssignments.set(node.id, clusterId)
          neighbors.forEach(nId => {
            visited.add(nId)
            clusterAssignments.set(nId, clusterId)
          })
        }
      })

      // Add cluster info to nodes
      layoutNodes.forEach(node => {
        if (clusterAssignments.has(node.id)) {
          node.clusterId = clusterAssignments.get(node.id)
        }
      })

      return {
        nodes: layoutNodes.map(n => ({
          id: n.id,
          type: n.type,
          label: n.label,
          x: n.x,
          y: n.y,
          z: n.z,
          memory_id: n.memory_id,
          title: n.title,
          url: n.url,
          source: n.source,
          preview: n.preview,
          importance_score: n.importance_score,
          hasEmbedding: n.hasEmbedding,
          clusterId: n.clusterId,
          layout: n.layout,
        })),
        edges,
      }
    } catch (error) {
      logger.error(`Error getting memory mesh for user ${userId}:`, error)
      throw error
    }
  }

  async searchMemories(
    userId: string,
    query: string,
    limit: number = 10,
    preFilteredMemoryIds?: string[],
    apiKeyId?: string | null
  ): Promise<MemoryRelation[]> {
    try {
      let queryEmbedding: number[] | null = null
      try {
        const embeddingResult = await aiProvider.generateEmbedding(query)
        queryEmbedding =
          typeof embeddingResult === 'object' && 'embedding' in embeddingResult
            ? (embeddingResult as { embedding: number[] }).embedding
            : (embeddingResult as number[])
      } catch {
        logger.warn('Embedding generation unavailable, falling back to metadata-based search')
      }

      if (queryEmbedding) {
        await ensureCollection()

        const filter: QdrantFilter = {
          must: [{ key: 'user_id', match: { value: userId } }],
        }

        if (apiKeyId !== undefined) {
          filter.must.push({ key: 'api_key_id', match: { value: apiKeyId || null } })
        }

        if (preFilteredMemoryIds && preFilteredMemoryIds.length > 0) {
          filter.must.push({
            key: 'memory_id',
            match: { any: preFilteredMemoryIds },
          })
        }

        const searchResult = await qdrantClient.search(COLLECTION_NAME, {
          vector: queryEmbedding,
          filter,
          limit: limit * 2,
          with_payload: true,
        })

        if (!searchResult || searchResult.length === 0) {
          return []
        }

        const memoryIds = searchResult
          .map(result => result.payload?.memory_id as string)
          .filter((id): id is string => !!id)

        if (memoryIds.length === 0) {
          return []
        }

        const fullMemories = await prisma.memory.findMany({
          where: { id: { in: memoryIds } },
        })

        const memoryMap = new Map(fullMemories.map(m => [m.id, m]))
        const scoreMap = new Map<string, number>()

        searchResult.forEach(result => {
          const memoryId = result.payload?.memory_id as string
          if (memoryId) {
            const existingScore = scoreMap.get(memoryId)
            const newScore = result.score || 0
            if (!existingScore || newScore > existingScore) {
              scoreMap.set(memoryId, newScore)
            }
          }
        })

        const queryTokens = query
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(token => token.length > 2)

        const scoredResults = Array.from(scoreMap.entries())
          .map(([memoryId, semanticScore]) => {
            const fullMemory = memoryMap.get(memoryId)
            if (!fullMemory) return null

            const title = (fullMemory.title || '').toLowerCase()
            const content = (fullMemory.content || '').toLowerCase()

            let keywordBonus = 0
            let matchedTokens = 0

            for (const token of queryTokens) {
              const tokenRegex = new RegExp(`\\b${token}\\b`, 'i')
              if (tokenRegex.test(title)) {
                keywordBonus += 0.15
                matchedTokens++
              }
              if (tokenRegex.test(content)) {
                keywordBonus += 0.1
                matchedTokens++
              }
            }

            const coverageRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0
            const finalScore = semanticScore + keywordBonus * coverageRatio

            return {
              memory: fullMemory as MemoryWithMetadata,
              similarity: finalScore,
              similarity_score: finalScore,
            }
          })
          .filter(
            (result): result is MemoryRelation & { similarity_score: number } =>
              result !== null &&
              result.memory !== undefined &&
              result.similarity_score !== undefined
          )
          .filter(result => result.similarity_score >= 0.15)
          .sort((a, b) => b.similarity_score - a.similarity_score)
          .slice(0, limit)

        return scoredResults
      }

      // Fallback: keyword search on metadata/title/content
      const memories = await prisma.memory.findMany({
        where: {
          user_id: userId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { page_metadata: { path: ['topics'], array_contains: [query] } },
            { page_metadata: { path: ['categories'], array_contains: [query] } },
            { page_metadata: { path: ['searchableTerms'], array_contains: [query] } },
          ],
        },
        take: limit,
      })

      return memories.map(m => ({ memory: m, similarity: 0.3, similarity_score: 0.3 }))
    } catch (error) {
      logger.error(`Error searching memories for user ${userId}:`, error)
      throw error
    }
  }

  async processMemoryForMesh(memoryId: string, userId: string): Promise<void> {
    try {
      await this.generateEmbeddingsForMemory(memoryId)
      await this.createMemoryRelations(memoryId, userId)
    } catch (error) {
      logger.error(`Error processing memory ${memoryId} for mesh:`, error)
      throw error
    }
  }

  async getMemoryWithRelations(
    memoryId: string
  ): Promise<{ memory: MemoryWithMetadata; relations: MemoryRelation[] } | null> {
    try {
      await ensureCollection()

      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
        include: {
          related_memories: {
            include: {
              related_memory: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  created_at: true,
                  page_metadata: true,
                },
              },
            },
            orderBy: { similarity_score: 'desc' },
          },
          related_to_memories: {
            include: {
              memory: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  created_at: true,
                  page_metadata: true,
                },
              },
            },
            orderBy: { similarity_score: 'desc' },
          },
        },
      })

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`)
      }

      const relations: MemoryRelation[] = [
        ...memory.related_memories.map(rel => ({
          memory: rel.related_memory as MemoryWithMetadata,
          similarity: rel.similarity_score,
          similarity_score: rel.similarity_score,
          relation_type: rel.relation_type,
          id: rel.related_memory.id,
        })),
        ...memory.related_to_memories.map(rel => ({
          memory: rel.memory as MemoryWithMetadata,
          similarity: rel.similarity_score,
          similarity_score: rel.similarity_score,
          relation_type: rel.relation_type,
          id: rel.memory.id,
        })),
      ]

      return {
        memory: memory as MemoryWithMetadata,
        relations,
      }
    } catch (error) {
      logger.error(`Error getting memory with relations for ${memoryId}:`, error)
      throw error
    }
  }

  async getMemoryCluster(
    userId: string,
    centerMemoryId: string,
    depth: number = 2
  ): Promise<{ memories: MemoryWithMetadata[]; relations: MemoryEdge[] }> {
    return meshClusteringService.getMemoryCluster(userId, centerMemoryId, depth)
  }

  private async createEmbeddingWithNamespace(
    memoryId: string,
    meshNamespaceId: string,
    text: string,
    type: string
  ): Promise<void> {
    try {
      await ensureCollection()
      const embeddingResult = await aiProvider.generateEmbedding(text)
      const embedding: number[] =
        typeof embeddingResult === 'object' && 'embedding' in embeddingResult
          ? (embeddingResult as { embedding: number[] }).embedding
          : (embeddingResult as number[])

      const pointId = randomUUID()
      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: {
              memory_id: memoryId,
              mesh_namespace_id: meshNamespaceId,
              embedding_type: type,
              model_name: GEMINI_EMBED_MODEL,
              created_at: new Date().toISOString(),
            },
          },
        ],
      })
    } catch (error) {
      logger.error(`Error creating ${type} embedding for memory ${memoryId}:`, error)
      throw error
    }
  }

  async upsertMemories(
    meshNamespaceId: string,
    apiKeyId: string,
    memories: Array<{
      id?: string
      content: string
      metadata?: Record<string, any>
    }>
  ): Promise<string[]> {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyId },
        include: {
          developer_app: {
            select: {
              developer_id: true,
            },
          },
        },
      })

      if (!apiKey) {
        throw new Error('API key not found')
      }

      const userId = apiKey.developer_app.developer_id
      const storedIds: string[] = []

      for (const memoryInput of memories) {
        const memoryId = memoryInput.id || randomUUID()

        const memory = await prisma.memory.upsert({
          where: { id: memoryId },
          update: {
            content: memoryInput.content,
            page_metadata: memoryInput.metadata || {},
            api_key_id: apiKeyId,
          },
          create: {
            id: memoryId,
            user_id: userId,
            source: 'sdk',
            content: memoryInput.content,
            canonical_text: memoryInput.content,
            page_metadata: memoryInput.metadata || {},
            timestamp: BigInt(Date.now()),
            api_key_id: apiKeyId,
          },
        })

        await this.createEmbeddingWithNamespace(memory.id, meshNamespaceId, memory.content, 'content')
        if (memory.title) {
          await this.createEmbeddingWithNamespace(memory.id, meshNamespaceId, memory.title, 'title')
        }

        storedIds.push(memory.id)
      }

      return storedIds
    } catch (error) {
      logger.error('Error upserting memories:', error)
      throw error
    }
  }

  async queryMemories(
    meshNamespaceId: string,
    query: string,
    filters?: Record<string, any>,
    limit: number = 10
  ): Promise<Array<{
    id: string
    content: string
    metadata?: Record<string, any>
    score: number
  }>> {
    try {
      await ensureCollection()

      const queryVector = await aiProvider.generateEmbedding(query)
      const embedding: number[] =
        typeof queryVector === 'object' && 'embedding' in queryVector
          ? (queryVector as { embedding: number[] }).embedding
          : (queryVector as number[])

      const filter: QdrantFilter = {
        must: [{ key: 'mesh_namespace_id', match: { value: meshNamespaceId } }],
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          filter.must.push({ key: `metadata.${key}`, match: { value } })
        }
      }

      const searchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: embedding,
        filter,
        limit: limit * 3,
        with_payload: true,
      })

      if (!searchResult || searchResult.length === 0) {
        return []
      }

      const memoryIds = searchResult.map(result => result.payload?.memory_id as string).filter(Boolean)

      if (memoryIds.length === 0) {
        return []
      }

      const memories = await prisma.memory.findMany({
        where: {
          id: { in: memoryIds },
        },
      })

      const memoryMap = new Map(memories.map(m => [m.id, m]))

      const results = searchResult
        .map(result => {
          const memoryId = result.payload?.memory_id as string
          const memory = memoryMap.get(memoryId)
          if (!memory) return null

          return {
            id: memory.id,
            content: memory.content,
            metadata: (memory.page_metadata as Record<string, any>) || {},
            score: result.score || 0,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return results
    } catch (error) {
      logger.error('Error querying memories:', error)
      throw error
    }
  }
}

export const memoryMeshService = new MemoryMeshService()
