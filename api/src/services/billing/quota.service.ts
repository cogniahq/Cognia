import { prisma } from '../../lib/prisma.lib'
import { getPlan, isUnlimited, PlanLimits } from './plans.config'

export interface QuotaCheckResult {
  ok: boolean
  reason?: 'seats' | 'memories' | 'integrations'
  limit?: number
  current?: number
  plan?: string
}

async function getOrgPlanId(orgId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  return sub?.plan_id ?? 'free'
}

export async function checkSeatAvailable(orgId: string): Promise<QuotaCheckResult> {
  const plan = getPlan(await getOrgPlanId(orgId))
  if (isUnlimited(plan.maxSeats)) return { ok: true, plan: plan.id }
  const count = await prisma.organizationMember.count({
    where: { organization_id: orgId, deactivated_at: null },
  })
  return count < plan.maxSeats
    ? { ok: true, plan: plan.id, current: count, limit: plan.maxSeats }
    : { ok: false, reason: 'seats', current: count, limit: plan.maxSeats, plan: plan.id }
}

export async function checkMemoryQuotaAvailable(
  userId: string,
  orgId: string | null
): Promise<QuotaCheckResult> {
  if (!orgId) return { ok: true } // personal accounts: unlimited (or wire up later)
  const plan = getPlan(await getOrgPlanId(orgId))
  if (isUnlimited(plan.maxMemories)) return { ok: true, plan: plan.id }
  const count = await prisma.memory.count({
    where: { organization_id: orgId, deleted_at: null },
  })
  return count < plan.maxMemories
    ? { ok: true, plan: plan.id, current: count, limit: plan.maxMemories }
    : { ok: false, reason: 'memories', current: count, limit: plan.maxMemories, plan: plan.id }
}

export async function checkIntegrationQuotaAvailable(orgId: string): Promise<QuotaCheckResult> {
  const plan = getPlan(await getOrgPlanId(orgId))
  if (isUnlimited(plan.maxIntegrations)) return { ok: true, plan: plan.id }
  const count = await prisma.organizationIntegration.count({
    where: { organization_id: orgId, status: { not: 'DISCONNECTED' } },
  })
  return count < plan.maxIntegrations
    ? { ok: true, plan: plan.id, current: count, limit: plan.maxIntegrations }
    : {
        ok: false,
        reason: 'integrations',
        current: count,
        limit: plan.maxIntegrations,
        plan: plan.id,
      }
}

export interface CurrentUsage {
  plan: PlanLimits
  usage: {
    seats: { current: number; limit: number }
    memories: { current: number; limit: number }
    integrations: { current: number; limit: number }
  }
}

export async function getCurrentUsage(orgId: string): Promise<CurrentUsage> {
  const planId = await getOrgPlanId(orgId)
  const plan = getPlan(planId)
  const [seats, memories, integrations] = await Promise.all([
    prisma.organizationMember.count({
      where: { organization_id: orgId, deactivated_at: null },
    }),
    prisma.memory.count({ where: { organization_id: orgId, deleted_at: null } }),
    prisma.organizationIntegration.count({
      where: { organization_id: orgId, status: { not: 'DISCONNECTED' } },
    }),
  ])
  return {
    plan,
    usage: {
      seats: { current: seats, limit: plan.maxSeats },
      memories: { current: memories, limit: plan.maxMemories },
      integrations: { current: integrations, limit: plan.maxIntegrations },
    },
  }
}
