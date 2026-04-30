import { Router, Response } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  OrganizationRequest,
} from '../middleware/organization.middleware'
import {
  createCheckoutSession,
  createPortalSession,
  isBillingEnabled,
} from '../services/billing/stripe.service'
import { getCurrentUsage } from '../services/billing/quota.service'
import { prisma } from '../lib/prisma.lib'

const router = Router({ mergeParams: true })

router.use('/:slug', authenticateToken, requireOrganization)

router.get('/:slug', async (req: OrganizationRequest, res: Response) => {
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
      subscription: sub,
      usage,
      invoices: recentInvoices,
    },
  })
})

router.post('/:slug/checkout', requireOrgAdmin, async (req: OrganizationRequest, res: Response) => {
  if (!isBillingEnabled()) {
    return res.status(503).json({ success: false, message: 'Billing not configured' })
  }
  if (!req.user?.email) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  const priceId = req.body?.priceId as string | undefined
  const successUrl =
    (req.body?.successUrl as string | undefined) ??
    `${process.env.PUBLIC_APP_URL ?? ''}/billing?success=true`
  const cancelUrl =
    (req.body?.cancelUrl as string | undefined) ??
    `${process.env.PUBLIC_APP_URL ?? ''}/billing?canceled=true`
  if (!priceId) return res.status(400).json({ success: false, message: 'priceId required' })
  try {
    const url = await createCheckoutSession(
      req.organization!.id,
      priceId,
      successUrl,
      cancelUrl,
      req.user.email
    )
    return res.json({ success: true, url })
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message })
  }
})

router.post('/:slug/portal', requireOrgAdmin, async (req: OrganizationRequest, res: Response) => {
  if (!isBillingEnabled()) {
    return res.status(503).json({ success: false, message: 'Billing not configured' })
  }
  const returnUrl =
    (req.body?.returnUrl as string | undefined) ?? `${process.env.PUBLIC_APP_URL ?? ''}/billing`
  try {
    const url = await createPortalSession(req.organization!.id, returnUrl)
    return res.json({ success: true, url })
  } catch (err) {
    return res.status(404).json({ success: false, message: (err as Error).message })
  }
})

export default router
