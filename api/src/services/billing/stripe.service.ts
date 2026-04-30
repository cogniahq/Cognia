// Stripe v22's TypeScript namespace lives outside the default export, so we
// import it as a value and type instances loosely. Callers that want richer
// types can `import type Stripe from 'stripe'` and cast as needed.
import Stripe from 'stripe'
import { prisma } from '../../lib/prisma.lib'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeClient = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StripeEvent = any

let stripeInstance: StripeClient | null = null

function getStripe(): StripeClient {
  if (stripeInstance) return stripeInstance
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set; billing disabled.')
  }
  stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2024-12-18.acacia' as any,
  })
  return stripeInstance
}

export function isBillingEnabled(): boolean {
  return !!STRIPE_SECRET_KEY
}

export async function ensureCustomer(
  orgId: string,
  email: string,
  name?: string
): Promise<string> {
  const stripe = getStripe()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (sub?.stripe_customer_id) return sub.stripe_customer_id

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { organization_id: orgId },
  })
  await prisma.subscription.upsert({
    where: { organization_id: orgId },
    create: { organization_id: orgId, stripe_customer_id: customer.id, plan_id: 'free' },
    update: { stripe_customer_id: customer.id },
  })
  return customer.id
}

export async function createCheckoutSession(
  orgId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string
): Promise<string> {
  const stripe = getStripe()
  const customerId = await ensureCustomer(orgId, customerEmail ?? '', undefined)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: orgId,
    subscription_data: { metadata: { organization_id: orgId } },
  })
  return session.url ?? ''
}

export async function createPortalSession(orgId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe()
  const sub = await prisma.subscription.findUnique({ where: { organization_id: orgId } })
  if (!sub?.stripe_customer_id) throw new Error('No Stripe customer for this org')
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  })
  return session.url
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string): StripeEvent {
  const stripe = getStripe()
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set')
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)
}

// Map a Stripe price id to a plan id (configured via env)
export function priceIdToPlan(priceId: string | undefined | null): 'free' | 'pro' | 'enterprise' {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise'
  return 'free'
}
