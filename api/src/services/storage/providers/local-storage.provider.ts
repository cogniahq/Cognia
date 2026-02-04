import * as fs from 'fs/promises'
import * as path from 'path'
import type { StorageProvider, StorageResult, StorageMetadata } from '../storage-provider.interface'
import { logger } from '../../../utils/core/logger.util'

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local'
  private basePath: string

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.LOCAL_STORAGE_PATH || './uploads'
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key)
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<StorageResult> {
    const fullPath = this.getFullPath(key)
    const dir = path.dirname(fullPath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })

    await fs.writeFile(fullPath, file)

    logger.log('[storage:local] uploaded', { key, size: file.length, contentType })

    return {
      key,
      url: fullPath,
      size: file.length,
      contentType,
    }
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key)
    return fs.readFile(fullPath)
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key)
    try {
      await fs.unlink(fullPath)
      logger.log('[storage:local] deleted', { key })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      // File doesn't exist, that's fine
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    // For local storage, return the file path
    // In production, you might want to generate a temporary token-based URL
    void expiresIn
    return this.getFullPath(key)
  }

  getPublicUrl(key: string): string | null {
    // Local storage doesn't have public URLs
    void key
    return null
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const fullPath = this.getFullPath(key)
    const stats = await fs.stat(fullPath)

    return {
      size: stats.size,
      contentType: 'application/octet-stream', // Would need mime-type detection
      lastModified: stats.mtime,
    }
  }
}
