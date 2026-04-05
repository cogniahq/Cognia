import test from 'node:test'
import assert from 'node:assert/strict'

import { getQueueLimiter } from './env.util'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
}

test.afterEach(() => {
  restoreEnv()
})

test('defaults BullMQ to a conservative limiter for OpenAI-backed processing', () => {
  delete process.env.QUEUE_RATE_MAX
  delete process.env.QUEUE_RATE_DURATION_MS
  process.env.GEN_PROVIDER = 'openai'
  process.env.EMBED_PROVIDER = 'openai'

  assert.deepEqual(getQueueLimiter(), {
    max: 1,
    duration: 60000,
  })
})

test('honors explicit BullMQ limiter overrides', () => {
  process.env.GEN_PROVIDER = 'openai'
  process.env.QUEUE_RATE_MAX = '3'
  process.env.QUEUE_RATE_DURATION_MS = '45000'

  assert.deepEqual(getQueueLimiter(), {
    max: 3,
    duration: 45000,
  })
})
