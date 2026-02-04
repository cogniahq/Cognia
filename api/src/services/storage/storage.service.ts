import type { StorageProvider, StorageResult, StorageMetadata } from './storage-provider.interface'
import { LocalStorageProvider } from './providers/local-storage.provider'
import { S3StorageProvider } from './providers/s3-storage.provider'
import { R2StorageProvider } from './providers/r2-storage.provider'
import { logger } from '../../utils/core/logger.util'

export type StorageProviderType = 'local' | 's3' | 'r2'

let storageInstance: StorageService | null = null

export class StorageService implements StorageProvider {
  private provider: StorageProvider

  get name(): string {
    return this.provider.name
  }

  constructor(providerType?: StorageProviderType) {
    const type = providerType || (process.env.STORAGE_PROVIDER as StorageProviderType) || 'local'

    switch (type) {
      case 's3':
        this.provider = new S3StorageProvider()
        break
      case 'r2':
        this.provider = new R2StorageProvider()
        break
      case 'local':
      default:
        this.provider = new LocalStorageProvider()
    }

    logger.log('[storage] initialized', { provider: this.provider.name })
  }

  /**
   * Get the singleton storage service instance
   */
  static getInstance(): StorageService {
    if (!storageInstance) {
      storageInstance = new StorageService()
    }
    return storageInstance
  }

  /**
   * Generate a unique storage key for a document
   */
  static generateDocumentKey(organizationId: string, filename: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `documents/${organizationId}/${timestamp}-${random}-${sanitizedFilename}`
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<StorageResult> {
    return this.provider.upload(file, key, contentType)
  }

  async download(key: string): Promise<Buffer> {
    return this.provider.download(key)
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key)
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(key, expiresIn)
  }

  getPublicUrl(key: string): string | null {
    return this.provider.getPublicUrl(key)
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    return this.provider.getMetadata(key)
  }
}

export const storageService = StorageService.getInstance()
