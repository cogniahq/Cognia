import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { enforce2FARequirement } from './require-2fa.middleware'
import { enforceSessionTimeout } from './session-timeout.middleware'
import { enforceIpAllowlist } from './ip-allowlist.middleware'

/**
 * Helper: build an express app whose `req.organization` getter throws,
 * forcing the middleware's catch branch.
 */
async function runWithError(
  middleware: any,
  reqOverrides: Record<string, unknown> = {}
): Promise<{ status: number; body: any }> {
  const app = express()
  app.use((req, _res, next) => {
    Object.assign(req, reqOverrides)
    next()
  })
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'organization', {
      get() {
        throw new Error('boom')
      },
    })
    next()
  })
  app.use(middleware)
  app.get('/', (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  const port = (server.address() as any).port
  const r = await fetch(`http://127.0.0.1:${port}/`)
  const body = await r.json()
  server.close()
  return { status: r.status, body }
}

test('fail-closed: enforce2FARequirement returns 503 on internal error', async () => {
  const r = await runWithError(enforce2FARequirement, { user: { id: 'u1' } })
  assert.equal(r.status, 503)
  assert.equal(r.body.code, 'SECURITY_CHECK_UNAVAILABLE')
})

test('fail-closed: enforceSessionTimeout returns 503 on internal error', async () => {
  const r = await runWithError(enforceSessionTimeout, { user: { id: 'u1', iat: 1 } })
  assert.equal(r.status, 503)
  assert.equal(r.body.code, 'SECURITY_CHECK_UNAVAILABLE')
})

test('fail-closed: enforceIpAllowlist returns 503 on internal error', async () => {
  const r = await runWithError(enforceIpAllowlist)
  assert.equal(r.status, 503)
  assert.equal(r.body.code, 'SECURITY_CHECK_UNAVAILABLE')
})

test('fail-closed: BREAKGLASS env var allows fail-open behavior', async () => {
  process.env.SECURITY_FAIL_OPEN_BREAKGLASS = 'true'
  try {
    const r = await runWithError(enforce2FARequirement, { user: { id: 'u1' } })
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
  } finally {
    delete process.env.SECURITY_FAIL_OPEN_BREAKGLASS
  }
})
