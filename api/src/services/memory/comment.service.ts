import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'
import { canRead } from './share.service'

export async function postComment(input: {
  memoryId: string
  authorUserId: string
  bodyMd: string
  parentId?: string
}) {
  const allowed = await canRead(input.memoryId, input.authorUserId)
  if (!allowed) throw new Error('Not allowed to comment on this memory')
  const c = await prisma.memoryComment.create({
    data: {
      memory_id: input.memoryId,
      author_user_id: input.authorUserId,
      body_md: input.bodyMd,
      parent_id: input.parentId,
    },
  })
  await auditLogService
    .logEvent({
      userId: input.authorUserId,
      eventType: 'comment_posted',
      eventCategory: 'data_management',
      action: 'post-comment',
      metadata: { memoryId: input.memoryId, commentId: c.id },
    })
    .catch(() => {})
  return c
}

export async function listComments(memoryId: string, viewerUserId: string | null) {
  if (!(await canRead(memoryId, viewerUserId))) throw new Error('Not allowed')
  return prisma.memoryComment.findMany({
    where: { memory_id: memoryId, deleted_at: null },
    include: { author: { select: { id: true, email: true } } },
    orderBy: { created_at: 'asc' },
  })
}

export async function editComment(commentId: string, authorUserId: string, bodyMd: string) {
  const c = await prisma.memoryComment.findFirst({
    where: { id: commentId, author_user_id: authorUserId },
  })
  if (!c) throw new Error('Comment not found')
  return prisma.memoryComment.update({ where: { id: commentId }, data: { body_md: bodyMd } })
}

export async function deleteComment(commentId: string, authorUserId: string) {
  const c = await prisma.memoryComment.findFirst({
    where: { id: commentId, author_user_id: authorUserId },
  })
  if (!c) throw new Error('Comment not found')
  await prisma.memoryComment.update({ where: { id: commentId }, data: { deleted_at: new Date() } })
}
