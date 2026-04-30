// Razorpay billing service. Replaces the prior Stripe integration.
//
// Razorpay differs from Stripe in three ways that matter here:
//   1) Server creates a `subscription`, then the client opens Razorpay Checkout
//      JS with that subscription_id (no redirect / hosted Checkout flow).
//   2) There is no hosted billing portal — we expose our own
//      pause/resume/cancel endpoints (see billing.route.ts).
//   3) Webhook signatures are HMAC-SHA256 of the raw body using the webhook
//      secret. We verify with timing-safe equality.
import Razorpay from 'razorpay'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '../../lib/prisma.lib'

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RazorpayClient = any

let instance: RazorpayClient | null = null

function getRazorpay(): RazorpayClient {
  if (instance) return instance
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set; billing disabled.')
  }
  instance = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
  return instance
}

export function isBillingEnabled(): boolean {
  return !!(KEY_ID && KEY_SECRET)
}

export function getPublicKeyId(): string | null {
  return KEY_ID ?? null
}

export async function ensureCustomer(orgId: string, email: string, name?: string): Promise<string> {
  const rp = getRazorpay()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (sub?.razorpay_customer_id) return sub.razorpay_customer_id

  // Razorpay's create-customer is idempotent when fail_existing=0 + same email.
  const customer = await rp.customers.create({
    name: name ?? email,
    email,
    fail_existing: 0,
    notes: { organization_id: orgId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  await prisma.subscription.upsert({
    where: { organization_id: orgId },
    create: { organization_id: orgId, razorpay_customer_id: customer.id, plan_id: 'free' },
    update: { razorpay_customer_id: customer.id },
  })
  return customer.id
}

export interface CreateSubscriptionResult {
  subscriptionId: string
  shortUrl: string | null
  status: string
}

export async function createSubscription(
  orgId: string,
  planId: string,
  email: string,
  totalCount = 12
): Promise<CreateSubscriptionResult> {
  const rp = getRazorpay()
  await ensureCustomer(orgId, email)
  // total_count = number of billing cycles. 12 monthly cycles = ~1y of billing.
  const sub = await rp.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    customer_notify: 1,
    notes: { organization_id: orgId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  await prisma.subscription.update({
    where: { organization_id: orgId },
    data: {
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: planId,
      status: sub.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      short_url: (sub as any).short_url ?? null,
    },
  })
  return {
    subscriptionId: sub.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shortUrl: (sub as any).short_url ?? null,
    status: sub.status,
  }
}

export async function cancelSubscription(orgId: string, atCycleEnd = true): Promise<void> {
  const rp = getRazorpay()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (!sub?.razorpay_subscription_id) throw new Error('No active subscription')
  await rp.subscriptions.cancel(sub.razorpay_subscription_id, atCycleEnd)
  await prisma.subscription.update({
    where: { organization_id: orgId },
    data: { cancel_at_period_end: atCycleEnd, status: atCycleEnd ? sub.status : 'cancelled' },
  })
}

export async function pauseSubscription(orgId: string): Promise<void> {
  const rp = getRazorpay()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (!sub?.razorpay_subscription_id) throw new Error('No active subscription')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await rp.subscriptions.pause(sub.razorpay_subscription_id, { pause_at: 'now' } as any)
  await prisma.subscription.update({
    where: { organization_id: orgId },
    data: { status: 'paused' },
  })
}

export async function resumeSubscription(orgId: string): Promise<void> {
  const rp = getRazorpay()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (!sub?.razorpay_subscription_id) throw new Error('No active subscription')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await rp.subscriptions.resume(sub.razorpay_subscription_id, { resume_at: 'now' } as any)
  await prisma.subscription.update({
    where: { organization_id: orgId },
    data: { status: 'active' },
  })
}

/**
 * HMAC-SHA256 signature verification.
 * Razorpay sends `X-Razorpay-Signature` as the lowercase hex HMAC of the raw body.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  if (!WEBHOOK_SECRET) throw new Error('RAZORPAY_WEBHOOK_SECRET not set')
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
}

export function planIdFromRazorpayPlan(
  razorpayPlanId: string | undefined | null
): 'free' | 'pro' | 'enterprise' {
  if (!razorpayPlanId) return 'free'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return 'pro'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_ENTERPRISE) return 'enterprise'
  return 'free'
}
