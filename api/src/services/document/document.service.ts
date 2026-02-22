import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { storageService, StorageService } from '../storage/storage.service'
import { addDocumentJob } from '../../lib/document-queue.lib'
import { DocumentStatus } from '@prisma/client'
import type { DocumentUploadInput, DocumentInfo } from '../../types/organization.types'
export class DocumentService {
  /**
   * Upload a new document and queue it for processing
   */
  async uploadDocument(input: DocumentUploadInput): Promise<DocumentInfo> {
    const { organizationId, uploaderId, file } = input

    // Generate unique storage key
    const storageKey = StorageService.generateDocumentKey(organizationId, file.originalname)

    // Upload to storage
    await storageService.upload(file.buffer, storageKey, file.mimetype)

    // Create document record
    const document = await prisma.document.create({
      data: {
        organization_id: organizationId,
        uploader_id: uploaderId,
        filename: storageKey.split('/').pop() || file.originalname,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: storageKey,
        storage_provider: storageService.name,
        status: DocumentStatus.PENDING,
      },
    })

    // Queue for processing
    await addDocumentJob({
      documentId: document.id,
      organizationId,
      uploaderId,
      storagePath: storageKey,
      mimeType: file.mimetype,
      filename: file.originalname,
    })

    logger.log('[document] uploaded and queued', {
      documentId: document.id,
      organizationId,
      filename: file.originalname,
    })

    return document
  }

  /**
   * Get document by ID with access check
   */
  async getDocument(documentId: string, organizationId: string): Promise<DocumentInfo | null> {
    return prisma.document.findFirst({
      where: {
        id: documentId,
        organization_id: organizationId,
      },
    })
  }

  /**
   * Get document info from a memory ID (for citations)
   */
  async getDocumentByMemoryId(
    memoryId: string,
    organizationId: string
  ): Promise<{ document: DocumentInfo; chunkContent: string; pageNumber: number | null } | null> {
    const chunk = await prisma.documentChunk.findFirst({
      where: {
        memory_id: memoryId,
        document: {
          organization_id: organizationId,
        },
      },
      include: {
        document: true,
      },
    })

    if (!chunk) {
      return null
    }

    return {
      document: chunk.document,
      chunkContent: chunk.content,
      pageNumber: chunk.page_number,
    }
  }

  /**
   * List documents for an organization
   */
  async listDocuments(
    organizationId: string,
    options: {
      status?: DocumentStatus
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ documents: DocumentInfo[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options

    const where = {
      organization_id: organizationId,
      ...(status && { status }),
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where }),
    ])

    return { documents, total }
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(documentId: string, organizationId: string): Promise<void> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organization_id: organizationId,
      },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Delete from storage
    try {
      await storageService.delete(document.storage_path)
    } catch (error) {
      logger.warn('[document] failed to delete from storage', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Delete document (cascades to chunks)
    await prisma.document.delete({
      where: { id: documentId },
    })

    logger.log('[document] deleted', { documentId, organizationId })
  }

  /**
   * Update document status
   */
  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    errorMessage?: string
  ): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        ...(errorMessage && { error_message: errorMessage }),
      },
    })

    logger.log('[document] status updated', { documentId, status })
  }

  /**
   * Update processing stage in metadata for granular status tracking
   */
  async updateProcessingStage(
    documentId: string,
    stage: 'extracting_text' | 'chunking' | 'generating_embeddings' | 'indexing' | 'completed',
    progress?: { current?: number; total?: number; summary?: string }
  ): Promise<void> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { metadata: true },
    })

    const existingMetadata = (document?.metadata as Record<string, unknown>) || {}

    await prisma.document.update({
      where: { id: documentId },
      data: {
        metadata: {
          ...existingMetadata,
          processing_stage: stage,
          processing_progress: progress,
          stage_updated_at: new Date().toISOString(),
        },
      },
    })

    logger.log('[document] processing stage updated', { documentId, stage, progress })
  }

  /**
   * Update document with processing results
   */
  async updateProcessingResults(
    documentId: string,
    results: {
      pageCount?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        page_count: results.pageCount,
        metadata: results.metadata as object | undefined,
        status: DocumentStatus.COMPLETED,
      },
    })
  }

  /**
   * Create document chunks and link to memories
   */
  async createChunks(
    documentId: string,
    chunks: Array<{
      content: string
      chunkIndex: number
      pageNumber?: number
      charStart: number
      charEnd: number
      memoryId?: string
    }>
  ): Promise<void> {
    await prisma.documentChunk.createMany({
      data: chunks.map(chunk => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        page_number: chunk.pageNumber,
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        memory_id: chunk.memoryId,
      })),
    })

    logger.log('[document] chunks created', {
      documentId,
      chunkCount: chunks.length,
    })
  }

  /**
   * Get document chunks
   */
  async getChunks(documentId: string) {
    return prisma.documentChunk.findMany({
      where: { document_id: documentId },
      orderBy: { chunk_index: 'asc' },
    })
  }

  /**
   * Get download URL for a document
   */
  async getDownloadUrl(documentId: string, organizationId: string): Promise<string> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organization_id: organizationId,
      },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    return storageService.getSignedUrl(document.storage_path, 3600) // 1 hour expiry
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(documentId: string, organizationId: string): Promise<void> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organization_id: organizationId,
        status: DocumentStatus.FAILED,
      },
    })

    if (!document) {
      throw new Error('Document not found or not in failed state')
    }

    // Reset status and clear error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING,
        error_message: null,
      },
    })

    // Delete existing chunks
    await prisma.documentChunk.deleteMany({
      where: { document_id: documentId },
    })

    // Re-queue for processing
    await addDocumentJob({
      documentId: document.id,
      organizationId,
      uploaderId: document.uploader_id,
      storagePath: document.storage_path,
      mimeType: document.mime_type,
      filename: document.original_name,
    })

    logger.log('[document] reprocessing queued', { documentId })
  }
}

export const documentService = new DocumentService()
