import crypto from 'crypto'

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET

if (!OAUTH_STATE_SECRET) {
  throw new Error(
    'FATAL: OAUTH_STATE_SECRET or JWT_SECRET must be set to secure OAuth callback state.'
  )
}

export type OAuthIntegrationType = 'user' | 'organization'

export interface OAuthStatePayload {
  integrationType: OAuthIntegrationType
  userId: string
  provider: string
  timestamp: number
  organizationId?: string
  organizationSlug?: string
}

function signState(encodedPayload: string): string {
  return crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(encodedPayload).digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function isOAuthStatePayload(value: unknown): value is OAuthStatePayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as Partial<OAuthStatePayload>
  const hasBaseFields =
    (payload.integrationType === 'user' || payload.integrationType === 'organization') &&
    typeof payload.userId === 'string' &&
    payload.userId.length > 0 &&
    typeof payload.provider === 'string' &&
    payload.provider.length > 0 &&
    typeof payload.timestamp === 'number' &&
    Number.isFinite(payload.timestamp)

  if (!hasBaseFields) {
    return false
  }

  if (payload.integrationType === 'organization') {
    return (
      typeof payload.organizationId === 'string' &&
      payload.organizationId.length > 0 &&
      typeof payload.organizationSlug === 'string' &&
      payload.organizationSlug.length > 0
    )
  }

  return true
}

export function createOAuthState(payload: OAuthStatePayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signState(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function parseOAuthState(
  state: string,
  maxAgeMs: number = OAUTH_STATE_TTL_MS
): OAuthStatePayload {
  const separatorIndex = state.lastIndexOf('.')

  if (separatorIndex <= 0 || separatorIndex === state.length - 1) {
    throw new Error('Invalid state format')
  }

  const encodedPayload = state.slice(0, separatorIndex)
  const signature = state.slice(separatorIndex + 1)
  const expectedSignature = signState(encodedPayload)

  if (!safeEqual(signature, expectedSignature)) {
    throw new Error('Invalid state signature')
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid state payload')
  }

  if (!isOAuthStatePayload(parsedPayload)) {
    throw new Error('Invalid state data')
  }

  const stateAge = Date.now() - parsedPayload.timestamp
  if (stateAge < 0 || stateAge > maxAgeMs) {
    throw new Error('Authorization expired')
  }

  return parsedPayload
}

/**
 * Sign-in OAuth state — used by the "Sign in with Google/Microsoft" flow.
 *
 * Unlike the integration state above, there is no logged-in `userId` at the
 * point we mint this state (the user is still anonymous). It carries the PKCE
 * `codeVerifier` and a `returnTo` that the callback redirects to. The HMAC
 * signing/parsing reuses the same secret + base64url+'.'+sig format as the
 * integration state to keep one consistent pattern.
 */

export type SignInOAuthProvider = 'google' | 'microsoft'

export interface SignInOAuthStatePayload {
  kind: 'signin'
  provider: SignInOAuthProvider
  codeVerifier: string
  returnTo: string
  timestamp: number
}

function isSignInOAuthStatePayload(value: unknown): value is SignInOAuthStatePayload {
  if (!value || typeof value !== 'object') {
    return false
  }
  const payload = value as Partial<SignInOAuthStatePayload>
  return (
    payload.kind === 'signin' &&
    (payload.provider === 'google' || payload.provider === 'microsoft') &&
    typeof payload.codeVerifier === 'string' &&
    payload.codeVerifier.length > 0 &&
    typeof payload.returnTo === 'string' &&
    typeof payload.timestamp === 'number' &&
    Number.isFinite(payload.timestamp)
  )
}

export function createSignInOAuthState(payload: {
  provider: SignInOAuthProvider
  codeVerifier: string
  returnTo: string
}): string {
  const fullPayload: SignInOAuthStatePayload = {
    kind: 'signin',
    provider: payload.provider,
    codeVerifier: payload.codeVerifier,
    returnTo: payload.returnTo,
    timestamp: Date.now(),
  }
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  const signature = signState(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function parseSignInOAuthState(
  state: string,
  maxAgeMs: number = OAUTH_STATE_TTL_MS
): SignInOAuthStatePayload {
  const separatorIndex = state.lastIndexOf('.')

  if (separatorIndex <= 0 || separatorIndex === state.length - 1) {
    throw new Error('Invalid state format')
  }

  const encodedPayload = state.slice(0, separatorIndex)
  const signature = state.slice(separatorIndex + 1)
  const expectedSignature = signState(encodedPayload)

  if (!safeEqual(signature, expectedSignature)) {
    throw new Error('Invalid state signature')
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid state payload')
  }

  if (!isSignInOAuthStatePayload(parsedPayload)) {
    throw new Error('Invalid state data')
  }

  const stateAge = Date.now() - parsedPayload.timestamp
  if (stateAge < 0 || stateAge > maxAgeMs) {
    throw new Error('Authorization expired')
  }

  return parsedPayload
}
