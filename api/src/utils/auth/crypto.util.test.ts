import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptString, decryptString, generateEncryptionKey } from './crypto.util'

const KEY = generateEncryptionKey() // 32 bytes hex

test('crypto: round-trips a string', () => {
  const ct = encryptString('hello world', KEY)
  assert.equal(decryptString(ct, KEY), 'hello world')
})

test('crypto: each call produces different ciphertext (random IV)', () => {
  const a = encryptString('same', KEY)
  const b = encryptString('same', KEY)
  assert.notEqual(a, b)
})

test('crypto: tampering detected', () => {
  const ct = encryptString('payload', KEY)
  const tampered = ct.slice(0, -4) + 'aaaa'
  assert.throws(() => decryptString(tampered, KEY))
})

test('crypto: wrong key fails', () => {
  const ct = encryptString('payload', KEY)
  const wrongKey = generateEncryptionKey()
  assert.throws(() => decryptString(ct, wrongKey))
})

test('crypto: rejects malformed key length', () => {
  assert.throws(() => encryptString('x', 'short'))
})
