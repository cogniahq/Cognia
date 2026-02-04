import { QdrantClient } from '@qdrant/js-client-rest'
import { logger } from '../utils/core/logger.util'

const globalForQdrant = globalThis as unknown as {
  qdrant: QdrantClient | undefined
}

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION || 768)
const COLLECTION_NAME = 'memory_embeddings'

interface QdrantClientOptions {
  url: string
  apiKey?: string
}

const qdrantOptions: QdrantClientOptions = { url: QDRANT_URL }
if (QDRANT_URL.startsWith('https://') && QDRANT_API_KEY) {
  qdrantOptions.apiKey = QDRANT_API_KEY
}

export const qdrantClient = globalForQdrant.qdrant ?? new QdrantClient(qdrantOptions)

if (process.env.NODE_ENV !== 'production') {
  globalForQdrant.qdrant = qdrantClient
}

export async function ensureCollection(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections()
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME)

    if (!collectionExists) {
      try {
        await qdrantClient.createCollection(COLLECTION_NAME, {
          vectors: {
            size: EMBEDDING_DIMENSION,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          hnsw_config: {
            m: 16,
            ef_construct: 100,
            full_scan_threshold: 10000,
          },
          on_disk_payload: false,
        })
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

      const payloadIndexes = collectionInfo.payload_schema || {}
      const needsMemoryIdIndex = !payloadIndexes.memory_id
      const needsEmbeddingTypeIndex = !payloadIndexes.embedding_type
      const needsUserIdIndex = !payloadIndexes.user_id

      if (needsMemoryIdIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'memory_id',
          field_schema: 'keyword',
        })
      }

      if (needsEmbeddingTypeIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'embedding_type',
          field_schema: 'keyword',
        })
      }

      if (needsUserIdIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'user_id',
          field_schema: 'keyword',
        })
      }

      // Add organization and source type indexes for document intelligence
      const needsOrgIdIndex = !payloadIndexes.organization_id
      const needsSourceTypeIndex = !payloadIndexes.source_type
      const needsDocumentIdIndex = !payloadIndexes.document_id

      if (needsOrgIdIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'organization_id',
          field_schema: 'keyword',
        })
      }

      if (needsSourceTypeIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'source_type',
          field_schema: 'keyword',
        })
      }

      if (needsDocumentIdIndex) {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'document_id',
          field_schema: 'keyword',
        })
      }
    } catch (indexError) {
      logger.warn('Error creating payload indexes (may already exist):', indexError)
    }
  } catch (error) {
    logger.error('Error ensuring Qdrant collection:', error)
    throw error
  }
}

export { COLLECTION_NAME, EMBEDDING_DIMENSION }
