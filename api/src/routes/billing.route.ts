import { Router, Response } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  OrganizationRequest,
} from '../middleware/organization.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import {
  createSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  isBillingEnabled,
  getPublicKeyId,
} from '../services/billing/razorpay.service'
import { getCurrentUsage } from '../services/billing/quota.service'
import { prisma } from '../lib/prisma.lib'

const router = Router({ mergeParams: true })

router.use('/:slug', authenticateToken, requireOrganization)

router.get(
  '/:slug',
  requirePermission('billing.read'),
  async (req: OrganizationRequest, res: Response) => {
    const orgId = req.organization!.id
    const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
    const usage = await getCurrentUsage(orgId)
    const recentInvoices = await prisma.invoice.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      take: 12,
    })
    res.json({
      success: true,
      data: {
        billingEnabled: isBillingEnabled(),
        provider: 'razorpay',
        publicKeyId: getPublicKeyId(),
        subscription: sub,
        usage,
        invoices: recentInvoices,
      },
    })
  }
)

// POST /:slug/checkout — creates a Razorpay subscription on the server, returns
// the subscription_id that the frontend feeds into Razorpay Checkout JS.
router.post(
  '/:slug/checkout',
  requireOrgAdmin,
  requirePermission('billing.manage'),
  async (req: OrganizationRequest, res: Response) => {
    if (!isBillingEnabled()) {
      return res.status(503).json({ success: false, message: 'Billing not configured' })
    }
    if (!req.user?.email) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }
    const planId = req.body?.planId as string | undefined // Razorpay plan_id
    const totalCount = Number(req.body?.totalCount) || 12
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' })
    try {
      const out = await createSubscription(req.organization!.id, planId, req.user.email, totalCount)
      return res.json({ success: true, ...out, keyId: getPublicKeyId() })
    } catch (err) {
      return res.status(500).json({ success: false, message: (err as Error).message })
    }
  }
)

// Custom portal endpoints — Razorpay has no hosted billing portal.
router.post(
  '/:slug/cancel',
  requireOrgAdmin,
  requirePermission('billing.cancel'),
  async (req: OrganizationRequest, res: Response) => {
    try {
      await cancelSubscription(req.organization!.id, req.body?.atCycleEnd !== false)
      return res.json({ success: true })
    } catch (err) {
      return res.status(404).json({ success: false, message: (err as Error).message })
    }
  }
)

router.post(
  '/:slug/pause',
  requireOrgAdmin,
  requirePermission('billing.manage'),
  async (req: OrganizationRequest, res: Response) => {
    try {
      await pauseSubscription(req.organization!.id)
      return res.json({ success: true })
    } catch (err) {
      return res.status(404).json({ success: false, message: (err as Error).message })
    }
  }
)

router.post(
  '/:slug/resume',
  requireOrgAdmin,
  requirePermission('billing.manage'),
  async (req: OrganizationRequest, res: Response) => {
    try {
      await resumeSubscription(req.organization!.id)
      return res.json({ success: true })
    } catch (err) {
      return res.status(404).json({ success: false, message: (err as Error).message })
    }
  }
)

export default router
