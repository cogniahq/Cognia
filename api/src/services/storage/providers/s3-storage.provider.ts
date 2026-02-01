import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageProvider, StorageResult, StorageMetadata } from '../storage-provider.interface'
import { logger } from '../../../utils/core/logger.util'

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3'
  private client: S3Client
  private bucket: string
  private publicUrlBase: string | null

  constructor() {
    const endpoint = process.env.S3_ENDPOINT
    const region = process.env.S3_REGION || 'us-east-1'

    this.client = new S3Client({
      region,
      ...(endpoint && { endpoint }),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    })

    this.bucket = process.env.S3_BUCKET || ''
    this.publicUrlBase = process.env.S3_PUBLIC_URL_BASE || null

    if (!this.bucket) {
      logger.warn('[storage:s3] S3_BUCKET not configured')
    }
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<StorageResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    })

    await this.client.send(command)

    logger.log('[storage:s3] uploaded', { key, size: file.length, contentType })

    return {
      key,
      url: this.getPublicUrl(key) || (await this.getSignedUrl(key)),
      size: file.length,
      contentType,
    }
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)
    const stream = response.Body

    if (!stream) {
      throw new Error(`File not found: ${key}`)
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    await this.client.send(command)
    logger.log('[storage:s3] deleted', { key })
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      await this.client.send(command)
      return true
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false
      }
      throw error
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return getSignedUrl(this.client, command, { expiresIn })
  }

  getPublicUrl(key: string): string | null {
    if (!this.publicUrlBase) {
      return null
    }
    return `${this.publicUrlBase}/${key}`
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      etag: response.ETag,
    }
  }
}
