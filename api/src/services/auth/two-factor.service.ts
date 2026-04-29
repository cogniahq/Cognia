import { encryptString, decryptString } from '../../utils/auth/crypto.util'

const PREFIX_V1 = 'enc:v1:'

function getKey(): string {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY
  if (!key) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not set')
  }
  return key
}

/**
 * Encrypt a TOTP shared secret for at-rest storage.
 * Output is prefixed with a version tag so future schemes can be added.
 */
export function encrypt2faSecret(plaintext: string): string {
  return PREFIX_V1 + encryptString(plaintext, getKey())
}

/**
 * Decrypt a stored TOTP shared secret.
 *
 * Dual-read behavior:
 * - Values starting with 'enc:v1:' are decrypted with the current key.
 * - Values without a known prefix are treated as legacy plaintext and
 *   returned as-is. The login path will re-encrypt and persist them on
 *   the next successful authentication.
 * - Values with an unrecognized 'enc:vN:' prefix throw.
 */
export function decrypt2faSecret(stored: string): string {
  if (stored.startsWith(PREFIX_V1)) {
    return decryptString(stored.slice(PREFIX_V1.length), getKey())
  }
  if (/^enc:v\d+:/.test(stored)) {
    throw new Error('Unsupported 2FA secret encryption version')
  }
  return stored
}

/**
 * Returns true if the stored value is unencrypted (legacy).
 * Used by the login path to opportunistically re-encrypt.
 */
export function is2faSecretLegacy(stored: string): boolean {
  return !stored.startsWith(PREFIX_V1)
}
