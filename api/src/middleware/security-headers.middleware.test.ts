import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { applySecurityHeaders } from './security-headers.middleware'

async function getHeaders(): Promise<Record<string, string>> {
  const app = express()
  applySecurityHeaders(app)
  app.get('/', (_req, res) => res.send('ok'))
  const server = app.listen(0)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('no address')
  const port = address.port
  const res = await fetch(`http://127.0.0.1:${port}/`)
  server.close()
  return Object.fromEntries(res.headers)
}

test('security headers: HSTS', async () => {
  const h = await getHeaders()
  assert.match(h['strict-transport-security'] ?? '', /max-age=\d+; includeSubDomains; preload/)
})

test('security headers: X-Content-Type-Options', async () => {
  const h = await getHeaders()
  assert.equal(h['x-content-type-options'], 'nosniff')
})

test('security headers: X-Frame-Options DENY', async () => {
  const h = await getHeaders()
  assert.equal(h['x-frame-options'], 'DENY')
})

test('security headers: Referrer-Policy', async () => {
  const h = await getHeaders()
  assert.equal(h['referrer-policy'], 'strict-origin-when-cross-origin')
})

test('security headers: Content-Security-Policy includes default-src', async () => {
  const h = await getHeaders()
  assert.match(h['content-security-policy'] ?? '', /default-src 'self'/)
})
