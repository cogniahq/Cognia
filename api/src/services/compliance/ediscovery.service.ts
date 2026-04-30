import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'

export async function searchOrg(opts: {
  orgId: string
  query: string
  limit?: number
  startDate?: Date
  endDate?: Date
  actorUserId: string
  actorEmail: string | null
  ipAddress?: string
  userAgent?: string
}): Promise<{ memories: unknown[]; comments: unknown[] }> {
  // Search across all org memories + comments.
  const limit = Math.min(opts.limit ?? 100, 500)
  const baseDate =
    opts.startDate || opts.endDate ? { gte: opts.startDate, lte: opts.endDate } : undefined

  const [memories, comments] = await Promise.all([
    prisma.memory.findMany({
      where: {
        organization_id: opts.orgId,
        ...(baseDate ? { created_at: baseDate } : {}),
        OR: [
          { title: { contains: opts.query, mode: 'insensitive' } },
          { content: { contains: opts.query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.memoryComment.findMany({
      where: {
        body_md: { contains: opts.query, mode: 'insensitive' },
        memory: { organization_id: opts.orgId },
        ...(baseDate ? { created_at: baseDate } : {}),
      },
      take: limit,
      include: {
        author: { select: { id: true, email: true } },
        memory: { select: { id: true, title: true } },
      },
    }),
  ])

  await auditLogService
    .logOrgEvent({
      orgId: opts.orgId,
      actorUserId: opts.actorUserId,
      actorEmail: opts.actorEmail,
      eventType: 'ediscovery_search',
      eventCategory: 'compliance',
      action: 'search',
      metadata: {
        query: opts.query.slice(0, 200),
        memoryHits: memories.length,
        commentHits: comments.length,
      },
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    })
    .catch(() => {})

  return { memories, comments }
}
