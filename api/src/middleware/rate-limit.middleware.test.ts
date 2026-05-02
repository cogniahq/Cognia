import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createRateLimiter } from './rate-limit.middleware'
import { getRedisClient } from '../lib/redis.lib'

// Use a unique key prefix per test run so we don't collide with other test
// suites (or repeat-runs) sharing the same Redis instance.
function uniquePrefix(label: string) {
  return `ratelimit-test:${label}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`
}

async function withApp<T>(
  middleware: ReturnType<typeof createRateLimiter>,
  fn: (port: number) => Promise<T>
): Promise<T> {
  const app = express()
  app.get('/probe', middleware, (_req, res) => {
    res.status(200).json({ ok: true })
  })
  const server = app.listen(0)
  try {
    const port = (server.address() as { port: number }).port
    return await fn(port)
  } finally {
    server.close()
  }
}

test('rate limiter sets Retry-After and X-RateLimit-Reset on 429', async () => {
  const windowMs = 60_000
  const maxRequests = 2
  const limiter = createRateLimiter({
    windowMs,
    maxRequests,
    keyPrefix: uniquePrefix('headers'),
    message: 'too many',
  })

  await withApp(limiter, async port => {
    // Burn through the allowed requests
    for (let i = 0; i < maxRequests; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/probe`)
      assert.equal(r.status, 200, `request ${i + 1} should succeed`)
    }

    // Next request should 429 with both headers populated
    const blocked = await fetch(`http://127.0.0.1:${port}/probe`)
    assert.equal(blocked.status, 429)

    const retryAfter = blocked.headers.get('retry-after')
    assert.ok(retryAfter, 'Retry-After header must be present on 429')
    const retryAfterNum = Number(retryAfter)
    assert.ok(Number.isFinite(retryAfterNum), 'Retry-After must be numeric')
    assert.ok(retryAfterNum >= 1, 'Retry-After must be >= 1 second')
    assert.ok(
      retryAfterNum <= Math.ceil(windowMs / 1000),
      `Retry-After must be <= window (${windowMs / 1000}s), got ${retryAfterNum}`
    )

    const reset = blocked.headers.get('x-ratelimit-reset')
    assert.ok(reset, 'X-RateLimit-Reset header must be present')
    const resetNum = Number(reset)
    assert.ok(Number.isFinite(resetNum), 'X-RateLimit-Reset must be numeric')
    // Should be a UNIX epoch in seconds, somewhere in [now, now + windowSec + slop]
    const nowSec = Math.floor(Date.now() / 1000)
    assert.ok(
      resetNum >= nowSec,
      `X-RateLimit-Reset (${resetNum}) must be >= now (${nowSec}); the spec is seconds-since-epoch, not milliseconds`
    )
    assert.ok(
      resetNum <= nowSec + Math.ceil(windowMs / 1000) + 5,
      `X-RateLimit-Reset (${resetNum}) must be <= now + window + slop`
    )
  })
})

test.after(async () => {
  // ioredis keeps the loop alive; close it so node:test exits cleanly.
  try {
    await getRedisClient().quit()
  } catch {
    /* swallow — best effort */
  }
})
