import crypto from 'crypto'

export interface SlackSignatureVerificationInput {
  rawBody: string
  signature?: string
  timestamp?: string
  signingSecret?: string
  nowSeconds?: number
  maxAgeSeconds?: number
}

export function verifySlackRequestSignature(input: SlackSignatureVerificationInput): boolean {
  const { rawBody, signature, timestamp, signingSecret } = input
  if (!signingSecret || !signature || !timestamp) return false

  const parsedTimestamp = Number(timestamp)
  if (!Number.isFinite(parsedTimestamp)) return false

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const maxAgeSeconds = input.maxAgeSeconds ?? 300
  if (Math.abs(nowSeconds - parsedTimestamp) > maxAgeSeconds) return false

  const base = `v0:${timestamp}:${rawBody}`
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`

  const expectedBytes = Buffer.from(expected)
  const signatureBytes = Buffer.from(signature)
  if (expectedBytes.length !== signatureBytes.length) return false
  return crypto.timingSafeEqual(expectedBytes, signatureBytes)
}
