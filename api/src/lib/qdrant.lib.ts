import { QdrantClient } from '@qdrant/js-client-rest'
import { logger } from '../utils/core/logger.util'
import { getConfiguredEmbeddingDimension } from '../services/ai/ai-config'
import type { SparseVector } from './sparse-encoder.lib'

const globalForQdrant = globalThis as unknown as {
  qdrant: QdrantClient | undefined
}

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const EMBEDDING_DIMENSION = getConfiguredEmbeddingDimension()
const COLLECTION_NAME = 'memory_embeddings'

export const DENSE_VECTOR_NAME = 'dense_content'
export const SPARSE_VECTOR_NAME = 'sparse_bm25'

interface QdrantClientOptions {
  url: string
  apiKey?: string
}

const qdrantOptions: QdrantClientOptions = { url: QDRANT_URL }
if (QDRANT_URL.startsWith('https://') && QDRANT_API_KEY) {
  qdrantOptions.apiKey = QDRANT_API_KEY
}

export const qdrantClient = globalForQdrant.qdrant ?? new QdrantClient(qdrantOptions)

let collectionEnsured = false
let ensureCollectionPromise: Promise<void> | null = null

if (process.env.NODE_ENV !== 'production') {
  globalForQdrant.qdrant = qdrantClient
}

const PAYLOAD_INDEXES: Array<{
  field: string
  schema: 'keyword' | 'integer' | 'float' | 'bool'
  isTenant?: boolean
}> = [
  { field: 'organization_id', schema: 'keyword', isTenant: true },
  { field: 'memory_id', schema: 'keyword' },
  { field: 'user_id', schema: 'keyword' },
  { field: 'source_type', schema: 'keyword' },
  { field: 'document_id', schema: 'keyword' },
]

export async function ensureCollection(): Promise<void> {
  if (collectionEnsured) return
  if (ensureCollectionPromise) return ensureCollectionPromise

  ensureCollectionPromise = (async () => {
    try {
      const collections = await qdrantClient.getCollections()
      const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME)

      if (!collectionExists) {
        try {
          await qdrantClient.createCollection(COLLECTION_NAME, {
            vectors: {
              [DENSE_VECTOR_NAME]: {
                size: EMBEDDING_DIMENSION,
                distance: 'Cosine',
                on_disk: true,
              },
            },
            sparse_vectors: {
              [SPARSE_VECTOR_NAME]: {
                modifier: 'idf',
                index: { on_disk: true },
              },
            },
            optimizers_config: {
              default_segment_number: 2,
            },
            hnsw_config: {
              m: 16,
              ef_construct: 100,
              full_scan_threshold: 20000,
              payload_m: 16,
            },
            on_disk_payload: true,
          })
          logger.log(`Qdrant collection '${COLLECTION_NAME}' created with named vectors`)
        } catch (createError: unknown) {
          const error = createError as { status?: number; data?: { status?: { error?: string } } }
          if (error?.status === 409 || error?.data?.status?.error?.includes('already exists')) {
            logger.log('Qdrant collection already exists, continuing...')
          } else {
            throw createError
          }
        }
      }

      try {
        const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME)
        const vectorParams = collectionInfo.config?.params?.vectors as
          | Record<string, { size?: number }>
          | { size?: number }
          | undefined

        const denseConfig =
          vectorParams && typeof vectorParams === 'object' && DENSE_VECTOR_NAME in vectorParams
            ? (vectorParams as Record<string, { size?: number }>)[DENSE_VECTOR_NAME]
            : (vectorParams as { size?: number } | undefined)

        const collectionVectorSize =
          typeof denseConfig?.size === 'number' ? denseConfig.size : undefined

        if (collectionVectorSize && collectionVectorSize !== EMBEDDING_DIMENSION) {
          throw new Error(
            `Qdrant collection '${COLLECTION_NAME}' uses ${collectionVectorSize}-dim vectors, but Cognia is configured for ${EMBEDDING_DIMENSION}. Update EMBEDDING_DIMENSION or recreate the collection with 'npm run clean:qdrant'.`
          )
        }

        const payloadIndexes = collectionInfo.payload_schema || {}
        for (const index of PAYLOAD_INDEXES) {
          if (payloadIndexes[index.field]) continue
          try {
            await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
              field_name: index.field,
              field_schema: index.isTenant ? { type: 'keyword', is_tenant: true } : index.schema,
            })
          } catch (e) {
            logger.warn(`Failed to create payload index for ${index.field}`, {
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      } catch (indexError) {
        logger.warn('Error verifying Qdrant collection / payload indexes', { error: indexError })
      }

      collectionEnsured = true
    } catch (error) {
      ensureCollectionPromise = null
      logger.error('Error ensuring Qdrant collection:', error)
      throw error
    }
  })()

  try {
    await ensureCollectionPromise
  } finally {
    if (collectionEnsured) {
      ensureCollectionPromise = null
    }
  }
}

export interface MemoryPointPayload {
  memory_id: string
  user_id: string
  organization_id?: string | null
  source_type?: string | null
  document_id?: string | null
  model_name?: string
  created_at?: string
  [key: string]: unknown
}

/**
 * Upsert a memory point with both dense and sparse vectors.
 * Sparse vector is optional but strongly recommended for hybrid search.
 */
export async function upsertMemoryPoint(point: {
  id: string
  dense: number[]
  sparse?: SparseVector | null
  payload: MemoryPointPayload
}): Promise<void> {
  await ensureCollection()

  const vector: Record<string, number[] | { indices: number[]; values: number[] }> = {
    [DENSE_VECTOR_NAME]: point.dense,
  }
  if (point.sparse && point.sparse.indices.length > 0) {
    vector[SPARSE_VECTOR_NAME] = {
      indices: point.sparse.indices,
      values: point.sparse.values,
    }
  }

  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: point.id,
        vector,
        payload: point.payload as Record<string, unknown>,
      },
    ],
  })
}

/**
 * Batched upsert for ingest pipelines. Same shape as upsertMemoryPoint but
 * issues a single Qdrant call per batch.
 */
export async function upsertMemoryPointsBatch(
  points: Array<{
    id: string
    dense: number[]
    sparse?: SparseVector | null
    payload: MemoryPointPayload
  }>
): Promise<void> {
  if (points.length === 0) return
  await ensureCollection()

  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: true,
    points: points.map(point => {
      const vector: Record<string, number[] | { indices: number[]; values: number[] }> = {
        [DENSE_VECTOR_NAME]: point.dense,
      }
      if (point.sparse && point.sparse.indices.length > 0) {
        vector[SPARSE_VECTOR_NAME] = {
          indices: point.sparse.indices,
          values: point.sparse.values,
        }
      }
      return {
        id: point.id,
        vector,
        payload: point.payload as Record<string, unknown>,
      }
    }),
  })
}

export interface QdrantPoint<P = Record<string, unknown>> {
  id: string | number
  score: number
  payload?: P | null
  vector?: number[] | Record<string, number[]> | null
}

interface QdrantFilterClause {
  must?: unknown[]
  must_not?: unknown[]
  should?: unknown[]
}

/**
 * Dense-only vector search against the named dense vector. Returns points[]
 * in the same shape callers had before named vectors landed.
 */
export async function searchDense(opts: {
  vector: number[]
  filter?: QdrantFilterClause
  limit: number
  scoreThreshold?: number
  withPayload?: boolean
  withVector?: boolean
}): Promise<QdrantPoint[]> {
  await ensureCollection()
  const result = await qdrantClient.query(COLLECTION_NAME, {
    query: opts.vector,
    using: DENSE_VECTOR_NAME,
    filter: opts.filter,
    limit: opts.limit,
    score_threshold: opts.scoreThreshold,
    with_payload: opts.withPayload ?? true,
    with_vector: opts.withVector ?? false,
  })
  return (result.points || []) as QdrantPoint[]
}

/**
 * Sparse vector search against the BM25 named vector.
 */
export async function searchSparse(opts: {
  sparse: SparseVector
  filter?: QdrantFilterClause
  limit: number
  withPayload?: boolean
}): Promise<QdrantPoint[]> {
  await ensureCollection()
  const result = await qdrantClient.query(COLLECTION_NAME, {
    query: { indices: opts.sparse.indices, values: opts.sparse.values },
    using: SPARSE_VECTOR_NAME,
    filter: opts.filter,
    limit: opts.limit,
    with_payload: opts.withPayload ?? true,
    with_vector: false,
  })
  return (result.points || []) as QdrantPoint[]
}

/**
 * Hybrid search combining dense + sparse via reciprocal-rank fusion (RRF)
 * inside Qdrant. Single round-trip.
 */
export async function searchHybrid(opts: {
  dense: number[]
  sparse?: SparseVector | null
  filter?: QdrantFilterClause
  prefetchLimit: number
  limit: number
  withPayload?: boolean
}): Promise<QdrantPoint[]> {
  await ensureCollection()

  if (!opts.sparse || opts.sparse.indices.length === 0) {
    return searchDense({
      vector: opts.dense,
      filter: opts.filter,
      limit: opts.limit,
      withPayload: opts.withPayload,
    })
  }

  const result = await qdrantClient.query(COLLECTION_NAME, {
    prefetch: [
      {
        query: opts.dense,
        using: DENSE_VECTOR_NAME,
        filter: opts.filter,
        limit: opts.prefetchLimit,
      },
      {
        query: { indices: opts.sparse.indices, values: opts.sparse.values },
        using: SPARSE_VECTOR_NAME,
        filter: opts.filter,
        limit: opts.prefetchLimit,
      },
    ],
    query: { fusion: 'rrf' },
    limit: opts.limit,
    with_payload: opts.withPayload ?? true,
    with_vector: false,
  })
  return (result.points || []) as QdrantPoint[]
}

export interface ScrollOptions {
  filter?: QdrantFilterClause
  limit: number
  offset?: string | number
  withPayload?: boolean
  withVector?: boolean | string[]
}

export async function scrollMemoryPoints(opts: ScrollOptions): Promise<{
  points: QdrantPoint[]
  next: string | number | null
}> {
  await ensureCollection()
  const result = await qdrantClient.scroll(COLLECTION_NAME, {
    filter: opts.filter,
    limit: opts.limit,
    offset: opts.offset,
    with_payload: opts.withPayload ?? true,
    with_vector: opts.withVector ?? false,
  })
  return {
    points: (result.points || []) as QdrantPoint[],
    next: (result.next_page_offset as string | number | null) ?? null,
  }
}

export async function deleteMemoryPoints(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return
  await ensureCollection()
  await qdrantClient.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [{ key: 'memory_id', match: { any: memoryIds } }],
    },
  })
}

export { COLLECTION_NAME, EMBEDDING_DIMENSION }
