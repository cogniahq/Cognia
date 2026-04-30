import { Response, NextFunction } from 'express'
import { OrganizationRequest } from './organization.middleware'
import {
  checkSeatAvailable,
  checkMemoryQuotaAvailable,
  checkIntegrationQuotaAvailable,
  QuotaCheckResult,
} from '../services/billing/quota.service'

function quotaResponse(res: Response, check: QuotaCheckResult): Response {
  return res.status(402).json({
    success: false,
    code: 'QUOTA_EXCEEDED',
    quotaExceeded: check.reason,
    current: check.current,
    limit: check.limit,
    plan: check.plan,
    message: `Plan limit reached. Upgrade to add more ${check.reason}.`,
  })
}

export async function requireSeatAvailable(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.organization) {
    next()
    return
  }
  const check = await checkSeatAvailable(req.organization.id)
  if (!check.ok) {
    quotaResponse(res, check)
    return
  }
  next()
}

export async function requireMemoryQuotaAvailable(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user?.id) {
    next()
    return
  }
  const check = await checkMemoryQuotaAvailable(req.user.id, req.organization?.id ?? null)
  if (!check.ok) {
    quotaResponse(res, check)
    return
  }
  next()
}

export async function requireIntegrationQuotaAvailable(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.organization) {
    next()
    return
  }
  const check = await checkIntegrationQuotaAvailable(req.organization.id)
  if (!check.ok) {
    quotaResponse(res, check)
    return
  }
  next()
}
