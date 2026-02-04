/**
 * TOTP (Time-based One-Time Password) Utility
 *
 * Implements RFC 6238 TOTP for 2FA
 */

import * as crypto from 'crypto'

const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'sha1'
const SECRET_LENGTH = 20 // bytes

/**
 * Generate a random base32 secret for TOTP
 */
export function generateSecret(): string {
  const buffer = crypto.randomBytes(SECRET_LENGTH)
  return base32Encode(buffer)
}

/**
 * Generate a TOTP code from a secret
 */
export function generateTOTP(secret: string, time?: number): string {
  const currentTime = time ?? Math.floor(Date.now() / 1000)
  const counter = Math.floor(currentTime / TOTP_PERIOD)

  // Decode base32 secret
  const secretBuffer = base32Decode(secret)

  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  // Generate HMAC
  const hmac = crypto.createHmac(TOTP_ALGORITHM, secretBuffer)
  hmac.update(counterBuffer)
  const hmacResult = hmac.digest()

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)

  // Generate TOTP_DIGITS digit code
  const otp = code % Math.pow(10, TOTP_DIGITS)
  return otp.toString().padStart(TOTP_DIGITS, '0')
}

/**
 * Verify a TOTP code
 * Allows for a window of ±1 period to account for clock skew
 */
export function verifyTOTP(secret: string, code: string, window: number = 1): boolean {
  const currentTime = Math.floor(Date.now() / 1000)

  // Normalize code
  const normalizedCode = code.replace(/\s/g, '')
  if (normalizedCode.length !== TOTP_DIGITS) {
    return false
  }

  // Check current period and adjacent periods within window
  for (let i = -window; i <= window; i++) {
    const checkTime = currentTime + i * TOTP_PERIOD
    const expectedCode = generateTOTP(secret, checkTime)
    if (normalizedCode === expectedCode) {
      return true
    }
  }

  return false
}

/**
 * Generate a QR code URI for authenticator apps
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = 'Cognia'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)

  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
}

/**
 * Generate backup codes (8 codes, 8 characters each)
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Generate 8 random hex characters
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }
  return codes
}

/**
 * Hash a backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex')
}

/**
 * Verify a backup code against a list of hashed codes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const normalizedCode = code.replace(/[-\s]/g, '').toUpperCase()
  const hashedInput = crypto.createHash('sha256').update(normalizedCode).digest('hex')

  return hashedCodes.indexOf(hashedInput)
}

// Base32 encoding/decoding (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let result = ''
  let bits = 0
  let value = 0

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      bits -= 5
      result += BASE32_ALPHABET[(value >> bits) & 0x1f]
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }

  return result
}

function base32Decode(encoded: string): Buffer {
  const cleanEncoded = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of cleanEncoded) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }

  return Buffer.from(bytes)
}
