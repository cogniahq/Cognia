/**
 * PKCE (RFC 7636) helpers for OAuth 2.0 Authorization Code with PKCE.
 *
 * - `generateCodeVerifier`: cryptographically random 43-char URL-safe string
 *   (base64url of 32 random bytes).
 * - `deriveCodeChallenge`: SHA-256 of the verifier, base64url-encoded — i.e.
 *   the `code_challenge_method=S256` value to send on the authorize URL.
 */

import { createHash, randomBytes } from 'node:crypto'

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
