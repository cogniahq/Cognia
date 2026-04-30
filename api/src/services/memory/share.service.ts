import { randomBytes } from 'node:crypto'
import type { Memory, MemoryShare } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { auditLogService } from '../core/audit-log.service'

export interface CreateShareInput {
  memoryId: string
  sharerUserId: string
  recipientType: 'USER' | 'ORG' | 'LINK'
  recipientUserId?: string
  recipientOrgId?: string
  permission?: 'READ' | 'COMMENT'
  expiresAt?: Date
}

export async function createShare(input: CreateShareInput) {
  const memory = await prisma.memory.findFirst({
    where: { id: input.memoryId, user_id: input.sharerUserId, deleted_at: null },
  })
  if (!memory) throw new Error('Memory not found or not owned')
  let linkToken: string | undefined
  if (input.recipientType === 'LINK') {
    linkToken = randomBytes(24).toString('base64url')
  }
  const share = await prisma.memoryShare.create({
    data: {
      memory_id: input.memoryId,
      sharer_user_id: input.sharerUserId,
      recipient_type: input.recipientType,
      recipient_user_id: input.recipientUserId,
      recipient_org_id: input.recipientOrgId,
      link_token: linkToken,
      permission: input.permission ?? 'READ',
      expires_at: input.expiresAt,
    },
  })
  await auditLogService
    .logEvent({
      userId: input.sharerUserId,
      eventType: 'memory_shared',
      eventCategory: 'data_management',
      action: 'share',
      metadata: { memoryId: input.memoryId, recipientType: input.recipientType },
    })
    .catch(() => {})
  return share
}

export async function listSharesForMemory(memoryId: string, sharerUserId: string) {
  return prisma.memoryShare.findMany({
    where: { memory_id: memoryId, sharer_user_id: sharerUserId, revoked_at: null },
    include: {
      recipient_user: { select: { id: true, email: true } },
      recipient_org: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { created_at: 'desc' },
  })
}

export async function revokeShare(shareId: string, sharerUserId: string): Promise<void> {
  const s = await prisma.memoryShare.findFirst({
    where: { id: shareId, sharer_user_id: sharerUserId },
  })
  if (!s) throw new Error('Share not found')
  await prisma.memoryShare.update({ where: { id: shareId }, data: { revoked_at: new Date() } })
  await auditLogService
    .logEvent({
      userId: sharerUserId,
      eventType: 'memory_unshared',
      eventCategory: 'data_management',
      action: 'revoke',
      metadata: { shareId },
    })
    .catch(() => {})
}

export async function getMemoryByShareLink(
  linkToken: string
): Promise<{ memory: Memory; share: MemoryShare } | null> {
  const share = await prisma.memoryShare.findUnique({
    where: { link_token: linkToken },
    include: { memory: true },
  })
  if (!share || share.revoked_at) return null
  if (share.expires_at && share.expires_at < new Date()) return null
  return { memory: share.memory, share }
}

export async function canRead(memoryId: string, viewerUserId: string | null): Promise<boolean> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } })
  if (!memory || memory.deleted_at) return false
  if (viewerUserId && memory.user_id === viewerUserId) return true

  if (viewerUserId) {
    // direct user share
    const direct = await prisma.memoryShare.findFirst({
      where: {
        memory_id: memoryId,
        recipient_user_id: viewerUserId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    })
    if (direct) return true
    // org share via membership
    if (memory.organization_id) {
      const member = await prisma.organizationMember.findFirst({
        where: {
          user_id: viewerUserId,
          organization_id: memory.organization_id,
          deactivated_at: null,
        },
      })
      if (member) return true
    }
    const orgShare = await prisma.memoryShare.findFirst({
      where: {
        memory_id: memoryId,
        recipient_type: 'ORG',
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        recipient_org: { members: { some: { user_id: viewerUserId, deactivated_at: null } } },
      },
    })
    if (orgShare) return true
  }
  return false
}
