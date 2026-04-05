import { randomUUID } from 'crypto'

import { PlatformUploadStatus } from '@prisma/client'

import { prisma } from '../../lib/prisma.lib'
import { storageService, StorageService } from '../storage/storage.service'
import { documentService } from '../document/document.service'
import type { PlatformDocumentMetadata } from '../../types/platform.types'

export class PlatformDocumentService {
  async createUploadSession(input: {
    appId: string
    tenantLinkId: string
    userLinkId: string
    organizationId: string
    uploaderId: string
    originalName: string
    mimeType: string
    fileSize: number
    metadata?: PlatformDocumentMetadata
  }) {
    const sessionId = randomUUID()
    const storageKey = StorageService.generateDocumentKey(input.organizationId, input.originalName)

    return prisma.platformUploadSession.create({
      data: {
        id: sessionId,
        trusted_app_id: input.appId,
        platform_tenant_link_id: input.tenantLinkId,
        platform_user_link_id: input.userLinkId,
        organization_id: input.organizationId,
        uploader_id: input.uploaderId,
        storage_key: storageKey,
        original_name: input.originalName,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        metadata: input.metadata as object | undefined,
        status: PlatformUploadStatus.PENDING,
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      },
    })
  }

  async uploadSessionContent(
    sessionId: string,
    file: {
      buffer: Buffer
      mimetype: string
      size: number
    }
  ) {
    const session = await prisma.platformUploadSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new Error('Upload session not found')
    }

    if (session.expires_at.getTime() < Date.now()) {
      await prisma.platformUploadSession.update({
        where: { id: sessionId },
        data: { status: PlatformUploadStatus.EXPIRED },
      })
      throw new Error('Upload session has expired')
    }

    await prisma.platformUploadSession.update({
      where: { id: sessionId },
      data: {
        status: PlatformUploadStatus.UPLOADING,
      },
    })

    await storageService.upload(file.buffer, session.storage_key, file.mimetype)

    return prisma.platformUploadSession.update({
      where: { id: sessionId },
      data: {
        status: PlatformUploadStatus.UPLOADED,
        uploaded_at: new Date(),
      },
    })
  }

  async completeUploadSession(sessionId: string) {
    const session = await prisma.platformUploadSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new Error('Upload session not found')
    }

    if (session.status !== PlatformUploadStatus.UPLOADED) {
      throw new Error('Upload session is not ready to complete')
    }

    const document = await documentService.createDocumentFromStoredUpload({
      organizationId: session.organization_id,
      uploaderId: session.uploader_id,
      storagePath: session.storage_key,
      originalname: session.original_name,
      mimetype: session.mime_type,
      size: session.file_size,
      metadata: {
        ...((session.metadata as Record<string, unknown> | null) || {}),
        uploadSessionId: session.id,
      },
    })

    await prisma.platformUploadSession.update({
      where: { id: sessionId },
      data: {
        status: PlatformUploadStatus.COMPLETED,
        completed_at: new Date(),
      },
    })

    return document
  }

  async getDocument(documentId: string, organizationId: string) {
    return documentService.getDocument(documentId, organizationId)
  }

  async getDownloadUrl(documentId: string, organizationId: string) {
    const downloadUrl = await documentService.getDownloadUrl(documentId, organizationId)

    return {
      downloadUrl,
      expiresInSeconds: 3600,
    }
  }

  async getDocumentContent(documentId: string, organizationId: string) {
    return documentService.getDocumentContent(documentId, organizationId)
  }

  async getCitationSource(memoryId: string, organizationId: string) {
    return documentService.getDocumentByMemoryId(memoryId, organizationId)
  }
}

export const platformDocumentService = new PlatformDocumentService()
