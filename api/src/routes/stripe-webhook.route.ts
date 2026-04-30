import { Router, raw } from 'express'
import {
  verifyWebhookSignature,
  priceIdToPlan,
  StripeEvent,
} from '../services/billing/stripe.service'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import { auditLogService } from '../services/core/audit-log.service'

const router = Router()

/**
 * Stripe webhook handler.
 * IMPORTANT: needs raw body to verify signature. This route is mounted BEFORE
 * the global express.json() in App.ts. Internally we also use express.raw()
 * defensively.
 */
router.post('/', raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  if (typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing signature' })
  }

  let event: StripeEvent
  try {
    event = verifyWebhookSignature(req.body as Buffer, sig)
  } catch (err) {
    logger.warn('[stripe-webhook] signature verification failed', { error: String(err) })
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // Idempotency: store and skip if already processed
  const existing = await prisma.billingEvent.findUnique({
    where: { stripe_event_id: event.id },
  })
  if (existing?.processed_at) {
    return res.json({ received: true, idempotent: true })
  }

  await prisma.billingEvent.upsert({
    where: { stripe_event_id: event.id },
    create: {
      stripe_event_id: event.id,
      type: event.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: event as any,
    },
    update: {},
  })

  try {
    await dispatchEvent(event)
    await prisma.billingEvent.update({
      where: { stripe_event_id: event.id },
      data: { processed_at: new Date() },
    })
    return res.json({ received: true })
  } catch (err) {
    logger.error('[stripe-webhook] dispatch failed', {
      error: String(err),
      eventType: event.type,
    })
    await prisma.billingEvent.update({
      where: { stripe_event_id: event.id },
      data: { error: String((err as Error).message ?? err) },
    })
    return res.status(500).json({ error: 'Handler failed' })
  }
})

async function dispatchEvent(event: StripeEvent): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = event?.data?.object
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const orgId = data?.metadata?.organization_id
      if (!orgId) break
      const priceId = data.items?.data?.[0]?.price?.id
      const planId = priceIdToPlan(priceId)
      await prisma.subscription.upsert({
        where: { organization_id: orgId },
        create: {
          organization_id: orgId,
          stripe_customer_id: data.customer,
          stripe_subscription_id: data.id,
          stripe_price_id: priceId,
          status: data.status,
          plan_id: planId,
          current_period_start: data.current_period_start
            ? new Date(data.current_period_start * 1000)
            : null,
          current_period_end: data.current_period_end
            ? new Date(data.current_period_end * 1000)
            : null,
          cancel_at_period_end: !!data.cancel_at_period_end,
          seats_purchased: data.items?.data?.[0]?.quantity ?? 1,
        },
        update: {
          stripe_subscription_id: data.id,
          stripe_price_id: priceId,
          status: data.status,
          plan_id: planId,
          current_period_start: data.current_period_start
            ? new Date(data.current_period_start * 1000)
            : null,
          current_period_end: data.current_period_end
            ? new Date(data.current_period_end * 1000)
            : null,
          cancel_at_period_end: !!data.cancel_at_period_end,
          seats_purchased: data.items?.data?.[0]?.quantity ?? 1,
        },
      })
      await auditLogService
        .logOrgEvent({
          orgId,
          actorUserId: null,
          actorEmail: null,
          eventType: 'organization_settings_changed',
          eventCategory: 'organization',
          action: 'subscription-updated',
          metadata: { planId, status: data.status, priceId },
        })
        .catch(() => {})
      break
    }
    case 'customer.subscription.deleted': {
      const orgId = data?.metadata?.organization_id
      if (!orgId) break
      await prisma.subscription.update({
        where: { organization_id: orgId },
        data: { status: 'canceled', plan_id: 'free' },
      })
      await auditLogService
        .logOrgEvent({
          orgId,
          actorUserId: null,
          actorEmail: null,
          eventType: 'organization_settings_changed',
          eventCategory: 'organization',
          action: 'subscription-canceled',
          metadata: { stripeSubscriptionId: data.id },
        })
        .catch(() => {})
      break
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const orgId =
        data?.subscription_details?.metadata?.organization_id ??
        data?.lines?.data?.[0]?.metadata?.organization_id
      if (!orgId) break
      await prisma.invoice.upsert({
        where: { stripe_invoice_id: data.id },
        create: {
          organization_id: orgId,
          stripe_invoice_id: data.id,
          amount_due_cents: data.amount_due ?? 0,
          amount_paid_cents: data.amount_paid ?? 0,
          currency: data.currency ?? 'usd',
          status: data.status,
          hosted_url: data.hosted_invoice_url,
          pdf_url: data.invoice_pdf,
          period_start: data.period_start ? new Date(data.period_start * 1000) : null,
          period_end: data.period_end ? new Date(data.period_end * 1000) : null,
          paid_at: data.status_transitions?.paid_at
            ? new Date(data.status_transitions.paid_at * 1000)
            : null,
        },
        update: {
          amount_paid_cents: data.amount_paid ?? 0,
          status: data.status,
          paid_at: data.status_transitions?.paid_at
            ? new Date(data.status_transitions.paid_at * 1000)
            : null,
        },
      })
      if (event.type === 'invoice.payment_failed') {
        await prisma.subscription
          .update({
            where: { organization_id: orgId },
            data: { status: 'past_due' },
          })
          .catch(() => {})
      }
      break
    }
  }
}

export default router
