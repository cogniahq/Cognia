import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'

export interface MemoryListOptions {
  userId: string
  organizationId?: string
  cursor?: string // base64 of "<timestamp>:<id>"
  limit?: number
  includeDeleted?: boolean
  onlyDeleted?: boolean
  q?: string
}

function encodeCursor(memory: { created_at: Date; id: string }): string {
  return Buffer.from(`${memory.created_at.toISOString()}:${memory.id}`).toString('base64')
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    // ISO timestamps contain ':' so split on the LAST ':' to separate the id.
    const lastColon = decoded.lastIndexOf(':')
    if (lastColon < 0) return null
    const iso = decoded.slice(0, lastColon)
    const id = decoded.slice(lastColon + 1)
    const createdAt = new Date(iso)
    if (isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export async function listMemories(opts: MemoryListOptions) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null
  const where: Prisma.MemoryWhereInput = { user_id: opts.userId }
  if (opts.organizationId) where.organization_id = opts.organizationId
  if (opts.onlyDeleted) where.deleted_at = { not: null }
  else if (!opts.includeDeleted) where.deleted_at = null
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: 'insensitive' } },
      { content: { contains: opts.q, mode: 'insensitive' } },
    ]
  }
  if (cursor) {
    const existingAnd = where.AND
    const previous: Prisma.MemoryWhereInput[] = Array.isArray(existingAnd)
      ? existingAnd
      : existingAnd
        ? [existingAnd]
        : []
    where.AND = [
      ...previous,
      {
        OR: [
          { created_at: { lt: cursor.createdAt } },
          { created_at: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ]
  }
  const items = await prisma.memory.findMany({
    where,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })
  const hasMore = items.length > limit
  const page = items.slice(0, limit)
  return {
    items: page,
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]) : null,
  }
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  data: { title?: string; content?: string; full_content?: string }
) {
  const m = await prisma.memory.findFirst({ where: { id: memoryId, user_id: userId } })
  if (!m) throw new Error('Memory not found')
  const updated = await prisma.memory.update({
    where: { id: memoryId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.full_content !== undefined && { full_content: data.full_content }),
    },
  })
  await auditLogService
    .logEvent({
      userId,
      eventType: 'memory_updated',
      eventCategory: 'data_management',
      action: 'update',
      metadata: { memoryId },
    })
    .catch(() => {})
  return updated
}

export async function softDeleteMemory(userId: string, memoryId: string): Promise<void> {
  const m = await prisma.memory.findFirst({
    where: { id: memoryId, user_id: userId, deleted_at: null },
  })
  if (!m) throw new Error('Memory not found')
  await prisma.memory.update({ where: { id: memoryId }, data: { deleted_at: new Date() } })
  await auditLogService
    .logEvent({
      userId,
      eventType: 'memory_deleted',
      eventCategory: 'data_management',
      action: 'soft-delete',
      metadata: { memoryId },
    })
    .catch(() => {})
}

export async function bulkSoftDelete(userId: string, ids: string[]): Promise<{ deleted: number }> {
  const result = await prisma.memory.updateMany({
    where: { id: { in: ids }, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date() },
  })
  await auditLogService
    .logEvent({
      userId,
      eventType: 'bulk_delete',
      eventCategory: 'data_management',
      action: 'bulk-soft-delete',
      metadata: { count: result.count, ids: ids.slice(0, 100) },
    })
    .catch(() => {})
  return { deleted: result.count }
}

export async function restoreMemory(userId: string, memoryId: string): Promise<void> {
  const m = await prisma.memory.findFirst({
    where: { id: memoryId, user_id: userId, deleted_at: { not: null } },
  })
  if (!m) throw new Error('Deleted memory not found')
  await prisma.memory.update({ where: { id: memoryId }, data: { deleted_at: null } })
}

export async function hardDeleteMemory(userId: string, memoryId: string): Promise<void> {
  const m = await prisma.memory.findFirst({ where: { id: memoryId, user_id: userId } })
  if (!m) throw new Error('Memory not found')
  await prisma.memory.delete({ where: { id: memoryId } })
}
