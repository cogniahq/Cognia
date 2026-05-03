import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { Prisma, MemoryType } from '@prisma/client'
import type { ExportBundle } from '../../types/common.types'

export type { ExportBundle }

export class ExportImportService {
  /**
   * Export all user data as a JSON bundle
   */
  async exportUserData(userId: string): Promise<ExportBundle> {
    try {
      const [user, memories, profile] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
          },
        }),
        prisma.memory.findMany({
          where: { user_id: userId },
          select: {
            id: true,
            title: true,
            url: true,
            content: true,
            source: true,
            timestamp: true,
            created_at: true,
            page_metadata: true,
            memory_type: true,
            importance_score: true,
            confidence_score: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.userProfile.findUnique({
          where: { user_id: userId },
          select: {
            static_profile_text: true,
            dynamic_profile_text: true,
            static_profile_json: true,
            dynamic_profile_json: true,
          },
        }),
      ])

      if (!user) {
        throw new Error('User not found')
      }

      const bundle: ExportBundle = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
        },
        memories: memories.map(m => ({
          id: m.id,
          title: m.title,
          url: m.url,
          content: m.content,
          source: m.source,
          timestamp: m.timestamp.toString(),
          created_at: m.created_at.toISOString(),
          page_metadata: m.page_metadata,
          memory_type: m.memory_type,
          importance_score: m.importance_score,
          confidence_score: m.confidence_score,
        })),
        profile: profile
          ? {
              static_profile_text: profile.static_profile_text,
              dynamic_profile_text: profile.dynamic_profile_text,
              static_profile_json: profile.static_profile_json,
              dynamic_profile_json: profile.dynamic_profile_json,
            }
          : null,
      }

      return bundle
    } catch (error) {
      logger.error('[export] Error exporting user data:', error)
      throw error
    }
  }

  /**
   * Import user data from a JSON bundle
   * This creates new records for the target user
   */
  async importUserData(
    targetUserId: string,
    bundle: ExportBundle
  ): Promise<{
    imported: {
      memories: number
      profile: boolean
    }
    errors: string[]
  }> {
    const errors: string[] = []
    let importedMemories = 0
    let importedProfile = false

    try {
      // Verify bundle version
      if (bundle.version !== '1.0') {
        throw new Error(`Unsupported bundle version: ${bundle.version}`)
      }

      // Memory.organization_id is required. Resolve the target user's first
      // active org so imported memories land somewhere sensible.
      const firstMembership = await prisma.organizationMember.findFirst({
        where: { user_id: targetUserId, deactivated_at: null },
        orderBy: { created_at: 'asc' },
        select: { organization_id: true },
      })
      if (!firstMembership) {
        throw new Error(
          'Cannot import memories: target user has no active organization membership.'
        )
      }
      const importOrganizationId = firstMembership.organization_id

      // Import memories (skip duplicates based on canonical_hash if available)
      for (const memory of bundle.memories) {
        try {
          // Check for existing memory by content hash or URL
          const existing = await prisma.memory.findFirst({
            where: {
              user_id: targetUserId,
              OR: [{ id: memory.id }, { url: memory.url || undefined }],
            },
          })

          if (existing) {
            logger.log('[import] Skipping duplicate memory', { memoryId: memory.id })
            continue
          }

          await prisma.memory.create({
            data: {
              user: { connect: { id: targetUserId } },
              organization: { connect: { id: importOrganizationId } },
              title: memory.title,
              url: memory.url,
              content: memory.content,
              source: memory.source,
              timestamp: BigInt(memory.timestamp),
              created_at: new Date(memory.created_at),
              page_metadata: memory.page_metadata as Prisma.InputJsonValue,
              memory_type: memory.memory_type as MemoryType,
              importance_score: memory.importance_score,
              confidence_score: memory.confidence_score,
            },
          })
          importedMemories++
        } catch (error) {
          errors.push(
            `Failed to import memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      // Import profile
      if (bundle.profile) {
        try {
          await prisma.userProfile.upsert({
            where: { user_id: targetUserId },
            create: {
              user_id: targetUserId,
              static_profile_text: bundle.profile.static_profile_text,
              dynamic_profile_text: bundle.profile.dynamic_profile_text,
              static_profile_json: (bundle.profile.static_profile_json ||
                {}) as Prisma.InputJsonValue,
              dynamic_profile_json: (bundle.profile.dynamic_profile_json ||
                {}) as Prisma.InputJsonValue,
            },
            update: {
              static_profile_text: bundle.profile.static_profile_text,
              dynamic_profile_text: bundle.profile.dynamic_profile_text,
              static_profile_json: (bundle.profile.static_profile_json ||
                {}) as Prisma.InputJsonValue,
              dynamic_profile_json: (bundle.profile.dynamic_profile_json ||
                {}) as Prisma.InputJsonValue,
            },
          })
          importedProfile = true
        } catch (error) {
          errors.push(
            `Failed to import profile: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      return {
        imported: {
          memories: importedMemories,
          profile: importedProfile,
        },
        errors,
      }
    } catch (error) {
      logger.error('[import] Error importing user data:', error)
      throw error
    }
  }
}

export const exportImportService = new ExportImportService()
