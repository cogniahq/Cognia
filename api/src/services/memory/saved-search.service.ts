import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'

export async function createSavedSearch(input: {
  userId: string
  organizationId?: string
  name: string
  query: string
  filters?: Record<string, unknown>
  alertEnabled?: boolean
  alertFrequency?: 'realtime' | 'daily' | 'weekly'
}) {
  return prisma.savedSearch.create({
    data: {
      user_id: input.userId,
      organization_id: input.organizationId,
      name: input.name,
      query: input.query,
      filters: (input.filters ?? {}) as Prisma.InputJsonValue,
      alert_enabled: input.alertEnabled ?? false,
      alert_frequency: input.alertFrequency ?? 'daily',
    },
  })
}

export async function listSavedSearches(userId: string, organizationId?: string) {
  return prisma.savedSearch.findMany({
    where: { user_id: userId, organization_id: organizationId ?? undefined },
    orderBy: { created_at: 'desc' },
  })
}

export async function updateSavedSearch(
  id: string,
  userId: string,
  patch: Partial<{
    name: string
    query: string
    filters: Record<string, unknown>
    alertEnabled: boolean
    alertFrequency: string
  }>
) {
  const s = await prisma.savedSearch.findFirst({ where: { id, user_id: userId } })
  if (!s) throw new Error('Saved search not found')
  return prisma.savedSearch.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.query !== undefined && { query: patch.query }),
      ...(patch.filters !== undefined && { filters: patch.filters as Prisma.InputJsonValue }),
      ...(patch.alertEnabled !== undefined && { alert_enabled: patch.alertEnabled }),
      ...(patch.alertFrequency !== undefined && { alert_frequency: patch.alertFrequency }),
    },
  })
}

export async function deleteSavedSearch(id: string, userId: string) {
  const s = await prisma.savedSearch.findFirst({ where: { id, user_id: userId } })
  if (!s) throw new Error('Saved search not found')
  await prisma.savedSearch.delete({ where: { id } })
}
