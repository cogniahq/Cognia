import { Worker } from 'bullmq'
import { DocumentStatus, SourceType } from '@prisma/client'
import { prisma } from '../lib/prisma.lib'
import { storageService } from '../services/storage/storage.service'
import { textExtractionService } from '../services/document/text-extraction.service'
import { textChunkingService } from '../services/document/text-chunking.service'
import { documentService } from '../services/document/document.service'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { memoryStructureService } from '../services/memory/memory-structure.service'
import { logger } from '../utils/core/logger.util'
import {
  getQueueConcurrency,
  getRedisConnection,
  getQueueLimiter,
  getQueueStalledInterval,
  getQueueMaxStalledCount,
} from '../utils/core/env.util'
import { normalizeUnixTimestampSeconds } from '../utils/core/timestamp.util'
import type { DocumentProcessingJob } from '../types/organization.types'

export const startDocumentWorker = () => {
  return new Worker<DocumentProcessingJob>(
    'process-document',
    async job => {
      const { documentId, organizationId, uploaderId, storagePath, mimeType, filename } = job.data

      logger.log('[document-worker] processing started', {
        jobId: job.id,
        documentId,
        filename,
      })

      try {
        // Update status to processing
        await documentService.updateStatus(documentId, DocumentStatus.PROCESSING)

        const documentRecord = await prisma.document.findUnique({
          where: { id: documentId },
          select: {
            metadata: true,
          },
        })

        const documentMetadata = (documentRecord?.metadata as Record<string, unknown> | null) || {}

        // Stage 1: Extracting text
        await documentService.updateProcessingStage(documentId, 'extracting_text')

        // Download file from storage
        const fileBuffer = await storageService.download(storagePath)

        // Extract text from document
        const extracted = await textExtractionService.extractText(fileBuffer, mimeType, filename)

        if (!extracted.text || extracted.text.trim().length === 0) {
          throw new Error('No text could be extracted from document')
        }

        // Stage 2: Chunking
        await documentService.updateProcessingStage(documentId, 'chunking', {
          summary: `Extracted ${extracted.text.length} characters${extracted.pageCount ? ` from ${extracted.pageCount} pages` : ''}`,
        })

        const textChunks = textChunkingService.chunkText(extracted.text)

        logger.log('[document-worker] text extracted and chunked', {
          jobId: job.id,
          documentId,
          textLength: extracted.text.length,
          chunkCount: textChunks.length,
          pageCount: extracted.pageCount,
        })

        // Stage 3: Creating memories and generating embeddings
        await documentService.updateProcessingStage(documentId, 'generating_embeddings', {
          current: 0,
          total: textChunks.length,
          summary: `Processing ${textChunks.length} chunks`,
        })

        const chunksWithMemories: Array<{
          content: string
          chunkIndex: number
          pageNumber?: number
          charStart: number
          charEnd: number
          memoryId?: string
        }> = []

        const EMBEDDING_BATCH_SIZE = 64
        const memoryIdsToEmbed: string[] = []

        // Pass 1: create Memory rows in a single tight loop, no Qdrant calls.
        for (const chunk of textChunks) {
          try {
            const structuredMetadata = memoryStructureService.extract({
              title: `${filename} - Chunk ${chunk.chunkIndex + 1}`,
              content: chunk.content,
              metadata: documentMetadata as Record<string, unknown>,
              source: 'document',
            })

            const memory = await prisma.memory.create({
              data: {
                user_id: uploaderId,
                source: 'document',
                title: `${filename} - Chunk ${chunk.chunkIndex + 1}`,
                content: chunk.content,
                timestamp: normalizeUnixTimestampSeconds(
                  documentMetadata.timestamp ?? documentMetadata.created_at
                ),
                source_type: SourceType.DOCUMENT,
                organization_id: organizationId,
                page_metadata: {
                  ...documentMetadata,
                  content_type: structuredMetadata.contentType,
                  structuredSummary: structuredMetadata.structuredSummary,
                  representativeExcerpt: structuredMetadata.representativeExcerpt,
                  keyFacts: structuredMetadata.keyFacts,
                  topics: structuredMetadata.topics,
                  categories: structuredMetadata.categories,
                  searchableTerms: structuredMetadata.searchableTerms,
                  extractedEntities: structuredMetadata.extractedEntities,
                  retrievalText: structuredMetadata.retrievalText,
                  ingestionVersion: structuredMetadata.ingestionVersion,
                  ...(structuredMetadata.commerce ? { commerce: structuredMetadata.commerce } : {}),
                  documentId,
                  chunkIndex: chunk.chunkIndex,
                  pageNumber: chunk.pageNumber,
                },
              },
            })

            chunksWithMemories.push({
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
              charStart: chunk.charStart,
              charEnd: chunk.charEnd,
              memoryId: memory.id,
            })
            memoryIdsToEmbed.push(memory.id)
          } catch (chunkError) {
            logger.error('[document-worker] chunk processing error', {
              documentId,
              chunkIndex: chunk.chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
            })

            chunksWithMemories.push({
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
              charStart: chunk.charStart,
              charEnd: chunk.charEnd,
            })
          }
        }

        // Pass 2: batched embedding + Qdrant upsert.
        for (let i = 0; i < memoryIdsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = memoryIdsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE)
          try {
            await memoryMeshService.generateEmbeddingsForMemoriesBatch(batch)
          } catch (embeddingError) {
            logger.error('[document-worker] batch embedding error', {
              documentId,
              batchSize: batch.length,
              error:
                embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
            })
          }

          await documentService.updateProcessingStage(documentId, 'generating_embeddings', {
            current: Math.min(i + batch.length, memoryIdsToEmbed.length),
            total: memoryIdsToEmbed.length,
            summary: `Indexed ${Math.min(i + batch.length, memoryIdsToEmbed.length)} of ${memoryIdsToEmbed.length} chunks`,
          })
        }

        // Stage 4: Indexing
        await documentService.updateProcessingStage(documentId, 'indexing', {
          summary: `Saving ${chunksWithMemories.length} chunks to database`,
        })

        // Create DocumentChunk records
        await documentService.createChunks(documentId, chunksWithMemories)

        // Mark as completed
        await documentService.updateProcessingStage(documentId, 'completed', {
          summary: `${chunksWithMemories.length} chunks indexed`,
        })

        // Update document with processing results
        await documentService.updateProcessingResults(documentId, {
          pageCount: extracted.pageCount,
          metadata: {
            ...extracted.metadata,
            chunk_count: chunksWithMemories.length,
            memory_count: chunksWithMemories.filter(c => c.memoryId).length,
          },
        })

        logger.log('[document-worker] processing completed', {
          jobId: job.id,
          documentId,
          chunksCreated: chunksWithMemories.length,
          memoriesCreated: chunksWithMemories.filter(c => c.memoryId).length,
        })

        return {
          success: true,
          documentId,
          chunksCreated: chunksWithMemories.length,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        logger.error('[document-worker] processing failed', {
          jobId: job.id,
          documentId,
          error: errorMessage,
        })

        // Update document status to failed
        await documentService.updateStatus(documentId, DocumentStatus.FAILED, errorMessage)

        throw error
      }
    },
    {
      connection: getRedisConnection(true),
      concurrency: getQueueConcurrency(),
      limiter: getQueueLimiter(),
      stalledInterval: getQueueStalledInterval(),
      maxStalledCount: getQueueMaxStalledCount(),
      lockDuration: 1200000, // 20 minutes - document processing can take longer
      lockRenewTime: 30000, // Renew lock every 30 seconds
    }
  )
}
