export interface StorageResult {
  key: string
  url: string
  size: number
  contentType: string
}

export interface StorageMetadata {
  size: number
  contentType: string
  lastModified: Date
  etag?: string
}

export interface StorageProvider {
  readonly name: string

  /**
   * Upload a file to storage
   */
  upload(file: Buffer, key: string, contentType: string): Promise<StorageResult>

  /**
   * Download a file from storage
   */
  download(key: string): Promise<Buffer>

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Get a signed URL for temporary access
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>

  /**
   * Get public URL if available (null if not public)
   */
  getPublicUrl(key: string): string | null

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<StorageMetadata>
}
