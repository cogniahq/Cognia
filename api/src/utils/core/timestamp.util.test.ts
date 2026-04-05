import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeUnixTimestampSeconds,
  normalizeUnixTimestampSecondsNumber,
} from './timestamp.util'

test('normalizes millisecond timestamps to Unix seconds', () => {
  assert.equal(normalizeUnixTimestampSeconds(1_711_987_200_123), BigInt(1_711_987_200))
  assert.equal(normalizeUnixTimestampSecondsNumber('1711987200123'), 1_711_987_200)
})

test('preserves second-based timestamps', () => {
  assert.equal(normalizeUnixTimestampSeconds(1_711_987_200), BigInt(1_711_987_200))
  assert.equal(normalizeUnixTimestampSeconds(BigInt(1_711_987_200)), BigInt(1_711_987_200))
})

test('converts Date inputs to Unix seconds', () => {
  const sourceDate = new Date('2026-03-31T12:34:56.000Z')
  assert.equal(normalizeUnixTimestampSeconds(sourceDate), BigInt(1_774_960_496))
})
