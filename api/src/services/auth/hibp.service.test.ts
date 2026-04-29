import test from 'node:test'
import assert from 'node:assert/strict'
import { isPasswordPwned } from './hibp.service'

test('hibp: known-pwned password "password" is detected', async () => {
  assert.equal(await isPasswordPwned('password'), true)
})

test('hibp: random 32-char string is unlikely to be pwned', async () => {
  const rand = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')
  assert.equal(await isPasswordPwned(rand), false)
})

test('hibp: HIBP unreachable does NOT block (fail-open with warning)', async () => {
  const orig = process.env.HIBP_API_BASE
  process.env.HIBP_API_BASE = 'http://127.0.0.1:1' // refused
  try {
    assert.equal(await isPasswordPwned('whatever'), false)
  } finally {
    if (orig === undefined) delete process.env.HIBP_API_BASE
    else process.env.HIBP_API_BASE = orig
  }
})
