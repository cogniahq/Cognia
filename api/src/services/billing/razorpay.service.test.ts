import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

// Set the secret BEFORE importing the service so module-level captures of
// process.env are not necessary (we re-read on every call).
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-secret'

import { verifyWebhookSignature, planIdFromRazorpayPlan } from './razorpay.service'

test('razorpay webhook: verifies HMAC-SHA256 signature with timing-safe equality', () => {
  const body = JSON.stringify({ event: 'subscription.activated', payload: {} })
  const sig = createHmac('sha256', 'test-secret').update(body).digest('hex')
  assert.equal(verifyWebhookSignature(body, sig), true)
  // Tampered signature of the same length must fail.
  const tampered = sig.slice(0, sig.length - 4) + '0000'
  assert.equal(verifyWebhookSignature(body, tampered), false)
})

test('razorpay webhook: rejects signature of different length without throwing', () => {
  const body = 'hello'
  assert.equal(verifyWebhookSignature(body, 'short'), false)
})

test('razorpay: planIdFromRazorpayPlan maps env-configured ids', () => {
  process.env.RAZORPAY_PLAN_PRO = 'plan_PRO_123'
  process.env.RAZORPAY_PLAN_ENTERPRISE = 'plan_ENT_456'
  assert.equal(planIdFromRazorpayPlan('plan_PRO_123'), 'pro')
  assert.equal(planIdFromRazorpayPlan('plan_ENT_456'), 'enterprise')
  assert.equal(planIdFromRazorpayPlan('plan_other'), 'free')
  assert.equal(planIdFromRazorpayPlan(null), 'free')
})
