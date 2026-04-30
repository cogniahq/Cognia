import { prisma } from '../../lib/prisma.lib'

export async function createTag(
  scope: { userId?: string; orgId?: string },
  name: string,
  color?: string
) {
  if (!scope.userId && !scope.orgId) throw new Error('Tag scope required')
  return prisma.memoryTag.create({
    data: { user_id: scope.userId, organization_id: scope.orgId, name, color },
  })
}

export async function listTags(scope: { userId?: string; orgId?: string }) {
  if (!scope.userId && !scope.orgId) return []
  return prisma.memoryTag.findMany({
    where: {
      OR: [
        ...(scope.userId ? [{ user_id: scope.userId }] : []),
        ...(scope.orgId ? [{ organization_id: scope.orgId }] : []),
      ],
    },
    orderBy: { name: 'asc' },
  })
}

export async function deleteTag(tagId: string, scope: { userId?: string; orgId?: string }) {
  const t = await prisma.memoryTag.findUnique({ where: { id: tagId } })
  if (!t) throw new Error('Tag not found')
  if (t.user_id && t.user_id !== scope.userId) throw new Error('Not allowed')
  if (t.organization_id && t.organization_id !== scope.orgId) throw new Error('Not allowed')
  await prisma.memoryTag.delete({ where: { id: tagId } })
}

export async function attachTag(memoryId: string, userId: string, tagId: string) {
  const m = await prisma.memory.findFirst({ where: { id: memoryId, user_id: userId } })
  if (!m) throw new Error('Memory not found')
  await prisma.memoryTagOnMemory.upsert({
    where: { memory_id_tag_id: { memory_id: memoryId, tag_id: tagId } },
    create: { memory_id: memoryId, tag_id: tagId },
    update: {},
  })
}

export async function detachTag(memoryId: string, userId: string, tagId: string) {
  const m = await prisma.memory.findFirst({ where: { id: memoryId, user_id: userId } })
  if (!m) throw new Error('Memory not found')
  await prisma.memoryTagOnMemory.deleteMany({ where: { memory_id: memoryId, tag_id: tagId } })
}
