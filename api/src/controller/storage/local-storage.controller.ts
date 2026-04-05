import { Request, Response, NextFunction } from 'express'
import * as fs from 'fs/promises'

import AppError from '../../utils/http/app-error.util'
import { logger } from '../../utils/core/logger.util'
import { isValidLocalStorageSignedUrl } from '../../services/storage/providers/local-storage-url.util'
import { resolveLocalStoragePath } from '../../services/storage/providers/local-storage.provider'

export class LocalStorageController {
  static async serveSignedFile(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.query.key
      if (typeof key !== 'string' || !key) {
        return next(new AppError('File key is required', 400))
      }

      const params = new URLSearchParams()
      for (const [queryKey, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          params.set(queryKey, value)
        }
      }

      if (!isValidLocalStorageSignedUrl(params)) {
        return next(new AppError('Invalid or expired file URL', 403))
      }

      const filePath = resolveLocalStoragePath(key)

      try {
        await fs.access(filePath)
      } catch {
        return next(new AppError('File not found', 404))
      }

      res.sendFile(filePath, error => {
        if (!error) {
          return
        }

        logger.error('[storage] local file send failed', {
          error: error.message,
          key,
        })
        if (!res.headersSent) {
          next(new AppError('Failed to load file', 500))
        }
      })
    } catch (error) {
      logger.error('[storage] local signed file error', {
        error: error instanceof Error ? error.message : String(error),
        key: req.query.key,
      })
      next(new AppError('Failed to load file', 500))
    }
  }
}
