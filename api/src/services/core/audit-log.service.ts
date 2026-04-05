import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { Prisma } from '@prisma/client'
import type { AuditEventType, AuditEventCategory } from '../../types/common.types'

export type { AuditEventType, AuditEventCategory }

interface AuditLogData {
  userId: string
  eventType: AuditEventType
  eventCategory: AuditEventCategory
  action: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export class AuditLogService {
  /**
   * Log an audit event
   */
  async logEvent(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          user_id: data.userId,
          event_type: data.eventType,
          event_category: data.eventCategory,
          action: data.action,
          metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
        },
      })
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      logger.warn('[audit] Failed to log event', {
        error: error instanceof Error ? error.message : String(error),
        eventType: data.eventType,
        userId: data.userId,
      })
    }
  }

  /**
   * Get audit logs for a user with optional filters
   */
  async getUserAuditLogs(
    userId: string,
    options?: {
      eventType?: AuditEventType
      eventCategory?: AuditEventCategory
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
    }
  ) {
    const where: Prisma.AuditLogWhereInput = { user_id: userId }

    if (options?.eventType) {
      where.event_type = options.eventType
    }

    if (options?.eventCategory) {
      where.event_category = options.eventCategory
    }

    if (options?.startDate || options?.endDate) {
      where.created_at = {}
      if (options.startDate) {
        where.created_at.gte = options.startDate
      }
      if (options.endDate) {
        where.created_at.lte = options.endDate
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      logs,
      total,
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
    }
  }

  /**
   * Log memory capture event
   */
  async logMemoryCapture(
    userId: string,
    memoryId: string,
    url: string,
    options?: { ipAddress?: string; userAgent?: string }
  ) {
    await this.logEvent({
      userId,
      eventType: 'memory_capture',
      eventCategory: 'capture',
      action: 'captured',
      metadata: { url, memoryId },
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    })
  }

  /**
   * Log memory search event
   */
  async logMemorySearch(
    userId: string,
    query: string,
    resultCount: number,
    options?: { ipAddress?: string; userAgent?: string }
  ) {
    await this.logEvent({
      userId,
      eventType: 'memory_search',
      eventCategory: 'search',
      action: 'searched',
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        resultCount,
      },
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    })
  }

  /**
   * Log memory deletion event
   */
  async logMemoryDelete(
    userId: string,
    memoryId: string,
    options?: { ipAddress?: string; userAgent?: string }
  ) {
    await this.logEvent({
      userId,
      eventType: 'memory_delete',
      eventCategory: 'data_management',
      action: 'deleted',
      metadata: { memoryId },
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    })
  }

  async logPlatformEvent(
    userId: string,
    eventType:
      | 'platform_tenant_sync'
      | 'platform_user_sync'
      | 'platform_membership_sync'
      | 'platform_document_upload'
      | 'platform_search',
    action: string,
    metadata?: Record<string, unknown>
  ) {
    await this.logEvent({
      userId,
      eventType,
      eventCategory: 'platform',
      action,
      metadata,
    })
  }
}

export const auditLogService = new AuditLogService()
