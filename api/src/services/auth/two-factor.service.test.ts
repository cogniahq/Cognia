import test from 'node:test'
import assert from 'node:assert/strict'
import { generateEncryptionKey } from '../../utils/auth/crypto.util'

// Set the env BEFORE requiring the service so its module-level fail-fast doesn't trip
process.env.TWO_FACTOR_ENCRYPTION_KEY = generateEncryptionKey()

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { encrypt2faSecret, decrypt2faSecret, is2faSecretLegacy } =
  require('./two-factor.service') as typeof import('./two-factor.service')

test('two-factor: encrypts then decrypts', () => {
  const plain = 'JBSWY3DPEHPK3PXP'
  const enc = encrypt2faSecret(plain)
  assert.notEqual(enc, plain)
  assert.match(enc, /^enc:v1:/)
  assert.equal(decrypt2faSecret(enc), plain)
})

test('two-factor: dual-read returns plaintext for legacy unprefixed values', () => {
  const legacyPlain = 'LEGACYTOTPSECRET'
  assert.equal(decrypt2faSecret(legacyPlain), legacyPlain)
  assert.equal(is2faSecretLegacy(legacyPlain), true)
  assert.equal(is2faSecretLegacy(encrypt2faSecret(legacyPlain)), false)
})

test('two-factor: rejects malformed encrypted prefix with unknown version', () => {
  assert.throws(() => decrypt2faSecret('enc:v9:garbage'))
})
