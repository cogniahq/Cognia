import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { verifySlackRequestSignature } from './slack-signature.service'

function sign(secret: string, timestamp: string, rawBody: string): string {
  return `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')}`
}

test('verifySlackRequestSignature accepts a valid Slack signature', () => {
  const secret = 'slack-secret'
  const timestamp = '1710000000'
  const rawBody = JSON.stringify({ type: 'event_callback', event_id: 'Ev1' })

  assert.equal(
    verifySlackRequestSignature({
      rawBody,
      signingSecret: secret,
      timestamp,
      signature: sign(secret, timestamp, rawBody),
      nowSeconds: 1710000100,
    }),
    true
  )
})

test('verifySlackRequestSignature rejects invalid signatures', () => {
  assert.equal(
    verifySlackRequestSignature({
      rawBody: '{"ok":true}',
      signingSecret: 'slack-secret',
      timestamp: '1710000000',
      signature: 'v0=bad',
      nowSeconds: 1710000000,
    }),
    false
  )
})

test('verifySlackRequestSignature rejects stale timestamps', () => {
  const secret = 'slack-secret'
  const timestamp = '1710000000'
  const rawBody = '{"ok":true}'

  assert.equal(
    verifySlackRequestSignature({
      rawBody,
      signingSecret: secret,
      timestamp,
      signature: sign(secret, timestamp, rawBody),
      nowSeconds: 1710001000,
    }),
    false
  )
})
