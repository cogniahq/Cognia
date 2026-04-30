import { prisma } from '../../lib/prisma.lib'

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'workspace'
  )
}

export async function createWorkspace(
  orgId: string,
  name: string,
  createdByUserId: string,
  description?: string
) {
  const baseSlug = slugify(name)
  let slug = baseSlug
  let i = 0
  while (
    await prisma.workspace.findUnique({
      where: { organization_id_slug: { organization_id: orgId, slug } },
    })
  ) {
    i++
    slug = `${baseSlug}-${i}`
  }
  return prisma.workspace.create({
    data: { organization_id: orgId, name, slug, description, created_by_user_id: createdByUserId },
  })
}

export async function listWorkspaces(orgId: string) {
  return prisma.workspace.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'asc' },
  })
}

export async function deleteWorkspace(orgId: string, workspaceId: string) {
  const w = await prisma.workspace.findFirst({ where: { id: workspaceId, organization_id: orgId } })
  if (!w) throw new Error('Workspace not found')
  await prisma.workspace.delete({ where: { id: workspaceId } })
}

export async function moveMemoryToWorkspace(
  memoryId: string,
  userId: string,
  workspaceId: string | null
) {
  const m = await prisma.memory.findFirst({ where: { id: memoryId, user_id: userId } })
  if (!m) throw new Error('Memory not found')
  return prisma.memory.update({ where: { id: memoryId }, data: { workspace_id: workspaceId } })
}
