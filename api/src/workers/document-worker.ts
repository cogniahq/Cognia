import { Worker } from 'bullmq'
import { DocumentStatus, SourceType } from '@prisma/client'
import { prisma } from '../lib/prisma.lib'
import { storageService } from '../services/storage/storage.service'
import { textExtractionService } from '../services/document/text-extraction.service'
import { textChunkingService } from '../services/document/text-chunking.service'
import { documentService } from '../services/document/document.service'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { logger } from '../utils/core/logger.util'
import {
  getQueueConcurrency,
  getRedisConnection,
  getQueueLimiter,
  getQueueStalledInterval,
  getQueueMaxStalledCount,
} from '../utils/core/env.util'
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

        // Download file from storage
        const fileBuffer = await storageService.download(storagePath)

        // Extract text from document
        const extracted = await textExtractionService.extractText(fileBuffer, mimeType, filename)

        if (!extracted.text || extracted.text.trim().length === 0) {
          throw new Error('No text could be extracted from document')
        }

        // Chunk the text
        const textChunks = textChunkingService.chunkText(extracted.text)

        logger.log('[document-worker] text extracted and chunked', {
          jobId: job.id,
          documentId,
          textLength: extracted.text.length,
          chunkCount: textChunks.length,
          pageCount: extracted.pageCount,
        })

        // Create Memory entries for each chunk and get embeddings
        const chunksWithMemories: Array<{
          content: string
          chunkIndex: number
          pageNumber?: number
          charStart: number
          charEnd: number
          memoryId?: string
        }> = []

        for (const chunk of textChunks) {
          try {
            // Create Memory entry with source_type=DOCUMENT
            const memory = await prisma.memory.create({
              data: {
                user_id: uploaderId,
                source: 'document',
                title: `${filename} - Chunk ${chunk.chunkIndex + 1}`,
                content: chunk.content,
                timestamp: BigInt(Date.now()),
                source_type: SourceType.DOCUMENT,
                organization_id: organizationId,
              },
            })

            // Generate embeddings and store in Qdrant (non-blocking)
            setImmediate(async () => {
              try {
                await memoryMeshService.generateEmbeddingsForMemory(memory.id)
              } catch (embeddingError) {
                logger.error('[document-worker] embedding error', {
                  documentId,
                  memoryId: memory.id,
                  error:
                    embeddingError instanceof Error
                      ? embeddingError.message
                      : String(embeddingError),
                })
              }
            })

            chunksWithMemories.push({
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
              charStart: chunk.charStart,
              charEnd: chunk.charEnd,
              memoryId: memory.id,
            })
          } catch (chunkError) {
            logger.error('[document-worker] chunk processing error', {
              documentId,
              chunkIndex: chunk.chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
            })

            // Still add the chunk without memory linkage
            chunksWithMemories.push({
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
              charStart: chunk.charStart,
              charEnd: chunk.charEnd,
            })
          }
        }

        // Create DocumentChunk records
        await documentService.createChunks(documentId, chunksWithMemories)

        // Update document with processing results
        await documentService.updateProcessingResults(documentId, {
          pageCount: extracted.pageCount,
          metadata: extracted.metadata,
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
