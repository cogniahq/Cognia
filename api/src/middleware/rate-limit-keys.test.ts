import test from 'node:test'
import assert from 'node:assert/strict'
import { userOrIpKey } from './rate-limit.middleware'

test('userOrIpKey returns user namespace when authenticated', () => {
  const req = {
    user: { id: 'abc-123' },
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
    ip: '10.0.0.1',
  } as any
  assert.equal(userOrIpKey(req), 'u:abc-123')
})

test('userOrIpKey falls back to ip namespace when no user', () => {
  const req = {
    headers: {},
    socket: { remoteAddress: '10.0.0.2' },
    ip: '10.0.0.2',
  } as any
  assert.equal(userOrIpKey(req), 'ip:10.0.0.2')
})

test('userOrIpKey reads X-Forwarded-For first', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' },
    socket: { remoteAddress: '10.0.0.1' },
    ip: '10.0.0.1',
  } as any
  assert.equal(userOrIpKey(req), 'ip:203.0.113.42')
})
