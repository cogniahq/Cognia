import { Router, raw } from 'express'
import {
  verifyWebhookSignature,
  planIdFromRazorpayPlan,
} from '../services/billing/razorpay.service'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import { auditLogService } from '../services/core/audit-log.service'

const router = Router()

/**
 * Razorpay webhook handler.
 * IMPORTANT: needs raw body to verify signature. This route is mounted BEFORE
 * the global express.json() in App.ts. Internally we also use express.raw()
 * defensively.
 */
router.post('/', raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['x-razorpay-signature']
  if (typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing signature' })
  }

  const rawBody = req.body as Buffer
  let valid = false
  try {
    valid = verifyWebhookSignature(rawBody, sig)
  } catch (err) {
    logger.warn('[razorpay-webhook] verify config error', { error: String(err) })
    return res.status(400).json({ error: 'Webhook secret not configured' })
  }
  if (!valid) {
    logger.warn('[razorpay-webhook] signature mismatch')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = JSON.parse(rawBody.toString())
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  // Razorpay events have `event` (string) and `payload` (object). There's no
  // top-level event id from Razorpay, so we synthesize an idempotency key from
  // event + entity id + created_at.
  const eventName = event.event as string
  const createdAt = event.created_at ?? Math.floor(Date.now() / 1000)
  const entityKey = (() => {
    const p = event.payload ?? {}
    const sub = p.subscription?.entity?.id
    const inv = p.invoice?.entity?.id
    const pay = p.payment?.entity?.id
    return (
      sub ?? inv ?? pay ?? `${eventName}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`
    )
  })()
  const eventId = `${eventName}:${entityKey}:${createdAt}`

  const existing = await prisma.billingEvent.findUnique({
    where: { razorpay_event_id: eventId },
  })
  if (existing?.processed_at) return res.json({ received: true, idempotent: true })

  await prisma.billingEvent.upsert({
    where: { razorpay_event_id: eventId },
    create: {
      razorpay_event_id: eventId,
      type: eventName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: event as any,
    },
    update: {},
  })

  try {
    await dispatchEvent(eventName, event)
    await prisma.billingEvent.update({
      where: { razorpay_event_id: eventId },
      data: { processed_at: new Date() },
    })
    return res.json({ received: true })
  } catch (err) {
    logger.error('[razorpay-webhook] dispatch failed', {
      error: String(err),
      eventName,
    })
    await prisma.billingEvent.update({
      where: { razorpay_event_id: eventId },
      data: { error: String((err as Error).message ?? err) },
    })
    return res.status(500).json({ error: 'Handler failed' })
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchEvent(eventName: string, event: any): Promise<void> {
  const subEntity = event.payload?.subscription?.entity
  const invEntity = event.payload?.invoice?.entity
  const payEntity = event.payload?.payment?.entity

  switch (eventName) {
    case 'subscription.authenticated':
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.pending':
    case 'subscription.halted':
    case 'subscription.resumed':
    case 'subscription.paused': {
      if (!subEntity) break
      const orgId = subEntity.notes?.organization_id
      if (!orgId) break
      const planId = planIdFromRazorpayPlan(subEntity.plan_id)
      await prisma.subscription.upsert({
        where: { organization_id: orgId },
        create: {
          organization_id: orgId,
          razorpay_customer_id: subEntity.customer_id,
          razorpay_subscription_id: subEntity.id,
          razorpay_plan_id: subEntity.plan_id,
          status: subEntity.status,
          plan_id: planId,
          current_period_start: subEntity.current_start
            ? new Date(subEntity.current_start * 1000)
            : null,
          current_period_end: subEntity.current_end ? new Date(subEntity.current_end * 1000) : null,
          seats_purchased: subEntity.quantity ?? 1,
          short_url: subEntity.short_url ?? null,
        },
        update: {
          razorpay_subscription_id: subEntity.id,
          razorpay_plan_id: subEntity.plan_id,
          status: subEntity.status,
          plan_id: planId,
          current_period_start: subEntity.current_start
            ? new Date(subEntity.current_start * 1000)
            : null,
          current_period_end: subEntity.current_end ? new Date(subEntity.current_end * 1000) : null,
          seats_purchased: subEntity.quantity ?? 1,
          short_url: subEntity.short_url ?? null,
        },
      })
      await auditLogService
        .logOrgEvent({
          orgId,
          actorUserId: null,
          actorEmail: null,
          eventType: 'organization_settings_changed',
          eventCategory: 'organization',
          action: `subscription-${eventName.replace('subscription.', '')}`,
          metadata: { planId, status: subEntity.status, razorpayPlanId: subEntity.plan_id },
        })
        .catch(() => {})
      break
    }
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.expired': {
      if (!subEntity) break
      const orgId = subEntity.notes?.organization_id
      if (!orgId) break
      await prisma.subscription
        .update({
          where: { organization_id: orgId },
          data: { status: subEntity.status, plan_id: 'free' },
        })
        .catch(() => {})
      await auditLogService
        .logOrgEvent({
          orgId,
          actorUserId: null,
          actorEmail: null,
          eventType: 'organization_settings_changed',
          eventCategory: 'organization',
          action: `subscription-${eventName.replace('subscription.', '')}`,
          metadata: { razorpaySubscriptionId: subEntity.id, status: subEntity.status },
        })
        .catch(() => {})
      break
    }
    case 'invoice.paid':
    case 'invoice.partially_paid':
    case 'invoice.expired': {
      if (!invEntity) break
      const orgId =
        invEntity.notes?.organization_id ?? invEntity.subscription?.notes?.organization_id
      if (!orgId) break
      await prisma.invoice.upsert({
        where: { razorpay_invoice_id: invEntity.id },
        create: {
          organization_id: orgId,
          razorpay_invoice_id: invEntity.id,
          razorpay_payment_id: invEntity.payment_id ?? null,
          amount_due_paise: invEntity.amount ?? 0,
          amount_paid_paise: invEntity.amount_paid ?? 0,
          currency: invEntity.currency ?? 'INR',
          status: invEntity.status,
          hosted_url: invEntity.short_url ?? null,
          period_start: invEntity.billing_start ? new Date(invEntity.billing_start * 1000) : null,
          period_end: invEntity.billing_end ? new Date(invEntity.billing_end * 1000) : null,
          paid_at: invEntity.paid_at ? new Date(invEntity.paid_at * 1000) : null,
        },
        update: {
          amount_paid_paise: invEntity.amount_paid ?? 0,
          status: invEntity.status,
          paid_at: invEntity.paid_at ? new Date(invEntity.paid_at * 1000) : null,
          razorpay_payment_id: invEntity.payment_id ?? null,
        },
      })
      break
    }
    case 'payment.failed': {
      if (!payEntity) break
      const subId = payEntity.subscription_id
      if (!subId) break
      const sub = await prisma.subscription.findFirst({
        where: { razorpay_subscription_id: subId },
      })
      if (sub) {
        await prisma.subscription.update({
          where: { organization_id: sub.organization_id },
          data: { status: 'halted' },
        })
      }
      break
    }
    case 'payment.captured': {
      // Already handled by subscription.charged in most flows; no-op here.
      break
    }
  }
}

export default router
