import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const KEY_LEN = 32
const TAG_LEN = 16

function keyToBuffer(hexKey: string): Buffer {
  const buf = Buffer.from(hexKey, 'hex')
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `Invalid encryption key length: expected ${KEY_LEN} bytes (${KEY_LEN * 2} hex chars), got ${buf.length}`
    )
  }
  return buf
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM.
 * Output format: base64(iv || tag || ciphertext)
 */
export function encryptString(plaintext: string, hexKey: string): string {
  const key = keyToBuffer(hexKey)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

/**
 * Decrypt a string produced by encryptString().
 * Throws on auth-tag mismatch (tampering or wrong key).
 */
export function decryptString(ciphertextB64: string, hexKey: string): string {
  const key = keyToBuffer(hexKey)
  const blob = Buffer.from(ciphertextB64, 'base64')
  if (blob.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Ciphertext too short')
  }
  const iv = blob.subarray(0, IV_LEN)
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = blob.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

/**
 * Convenience: generate a fresh 32-byte hex key for env config.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LEN).toString('hex')
}
