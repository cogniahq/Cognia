import { Response } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'
import { memoryIngestionService } from '../../services/memory/memory-ingestion.service'
import { memoryMeshService } from '../../services/memory/memory-mesh.service'
import { profileUpdateService } from '../../services/profile/profile-update.service'
import { auditLogService } from '../../services/core/audit-log.service'
import { backgroundGenerationPriorityService } from '../../services/core/background-generation-priority.service'
import { isOpenAISearchOnlyModeEnabled } from '../../services/ai/ai-config'
import { logger } from '../../utils/core/logger.util'
import { createHash } from 'crypto'

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

type PrismaError = {
  code?: string
  message?: string
}

const PROFILE_IMPORTANCE_THRESHOLD = Number(process.env.PROFILE_IMPORTANCE_THRESHOLD || 0.7)

const isSearchPriorityLeaseActive = async (): Promise<boolean> => {
  try {
    return await backgroundGenerationPriorityService.shouldDeferBackgroundGeneration()
  } catch (error) {
    logger.warn('[memory/process] search-priority lease check failed, continuing', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export class MemoryProcessingController {
  static async processRawContent(req: AuthenticatedRequest, res: Response) {
    try {
      const { content, url, title, metadata } = req.body

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required',
        })
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        })
      }

      const userId = req.user.id

      logger.log('[memory/process] inbound', {
        ts: new Date().toISOString(),
        userId: userId,
        url: typeof url === 'string' ? url.slice(0, 200) : undefined,
        title: typeof title === 'string' ? title.slice(0, 200) : undefined,
        contentLen: typeof content === 'string' ? content.length : undefined,
      })

      const metadataPayload =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)
          : undefined

      const canonicalData = memoryIngestionService.canonicalizeContent(content, url)

      const duplicateCheck = await memoryIngestionService.findDuplicateMemory({
        userId,
        canonicalHash: canonicalData.canonicalHash,
        canonicalText: canonicalData.canonicalText,
        url,
        title,
        source: (metadataPayload?.source as string | undefined) || undefined,
      })

      if (duplicateCheck) {
        const merged = await memoryIngestionService.mergeDuplicateMemory(
          duplicateCheck.memory,
          metadataPayload,
          {
            title,
            url,
            source: (metadataPayload?.source as string | undefined) || undefined,
            content,
          }
        )
        const serializedExisting = {
          ...merged,
          timestamp: merged.timestamp ? merged.timestamp.toString() : null,
        }
        logger.log('[memory/process] duplicate_short_circuit', {
          reason: duplicateCheck.reason,
          memoryId: merged.id,
          userId,
        })
        return res.status(200).json({
          success: true,
          message: 'Duplicate memory detected, returning existing record',
          data: {
            userId: userId,
            memory: serializedExisting,
            isDuplicate: true,
          },
        })
      }

      const urlHash = hashUrl(url || 'unknown')

      const dbCreateStart = Date.now()
      let memory
      try {
        const memoryCreateInput = await memoryIngestionService.buildMemoryCreatePayload({
          userId,
          title,
          url,
          source: (metadataPayload?.source as string | undefined) || undefined,
          content,
          contentPreview: content.slice(0, 400),
          metadata: metadataPayload,
          canonicalText: canonicalData.canonicalText,
          canonicalHash: canonicalData.canonicalHash,
        })

        memory = await prisma.memory.create({
          data: memoryCreateInput,
        })
        logger.log('[memory/process] db_memory_created', {
          ms: Date.now() - dbCreateStart,
          memoryId: memory.id,
          userId: userId,
        })

        if (url && typeof url === 'string') {
          auditLogService
            .logMemoryCapture(userId, memory.id, url, {
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
            })
            .catch(err => {
              logger.warn('[memory/process] audit_log_failed', {
                error: err instanceof Error ? err.message : String(err),
              })
            })
        }
      } catch (createError) {
        const error = createError as PrismaError
        if (error.code === 'P2002' && canonicalData.canonicalHash) {
          const existingMemory = await prisma.memory.findFirst({
            where: { user_id: userId, canonical_hash: canonicalData.canonicalHash },
            select: {
              id: true,
              title: true,
              url: true,
              timestamp: true,
              created_at: true,
              content: true,
              source: true,
              page_metadata: true,
              canonical_text: true,
              canonical_hash: true,
            },
          })

          if (existingMemory) {
            const serializedExisting = {
              ...existingMemory,
              timestamp: existingMemory.timestamp ? existingMemory.timestamp.toString() : null,
            }
            logger.log('[memory/process] duplicate_detected_on_create', {
              existingMemoryId: existingMemory.id,
              userId: userId,
            })
            return res.status(200).json({
              success: true,
              message: 'Duplicate memory detected, returning existing record',
              data: {
                userId: userId,
                memory: serializedExisting,
                isDuplicate: true,
              },
            })
          }
        }
        throw createError
      }

      logger.log('[memory/process] done', { memoryId: memory.id })

      setImmediate(async () => {
        try {
          const snapStart = Date.now()
          await prisma.memorySnapshot.create({
            data: {
              user_id: userId,
              raw_text: content,
            },
          })
          logger.log('[memory/process] snapshot_created', {
            ms: Date.now() - snapStart,
            memoryId: memory.id,
          })
        } catch (snapshotError) {
          logger.error(`Error creating snapshot for memory ${memory.id}:`, snapshotError)
        }

        try {
          const meshStart = Date.now()
          logger.log('[memory/process] mesh_start', { memoryId: memory.id, userId: userId })
          await memoryMeshService.processMemoryForMesh(memory.id, userId)
          logger.log('[memory/process] mesh_done', {
            ms: Date.now() - meshStart,
            memoryId: memory.id,
          })
        } catch (meshError) {
          logger.error(`Error processing memory ${memory.id} for mesh:`, meshError)
        }

        try {
          if (isOpenAISearchOnlyModeEnabled()) {
            logger.log('[memory/process] profile update skipped', {
              reason: 'OPENAI_SEARCH_ONLY_MODE',
              memoryId: memory.id,
              userId,
            })
            return
          }

          if ((memory.importance_score || 0) >= PROFILE_IMPORTANCE_THRESHOLD) {
            if (await isSearchPriorityLeaseActive()) {
              logger.log('[memory/process] profile update deferred for search priority lease', {
                memoryId: memory.id,
                userId,
              })
              return
            }
            const shouldUpdate = await profileUpdateService.shouldUpdateProfile(userId, 3)
            if (shouldUpdate) {
              logger.log('[memory/process] profile_update_triggered', {
                memoryId: memory.id,
                userId,
              })
              await profileUpdateService.updateUserProfile(userId)
            }
          }
        } catch (profileError) {
          logger.error(`[memory/process] profile update failed for ${memory.id}`, profileError)
        }
      })
      res.status(200).json({
        success: true,
        message: 'Content processed and stored successfully',
        data: {
          userId: userId,
          memoryId: memory.id,
          urlHash,
          transactionDetails: null,
        },
      })
    } catch (error) {
      logger.error('Error processing raw content:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process raw content',
      })
    }
  }
}
