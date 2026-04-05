import crypto from 'crypto'

const LOCAL_STORAGE_ROUTE_PATH = '/api/storage/local'

function getSigningSecret(): string {
  const secret = process.env.LOCAL_STORAGE_SIGNING_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('LOCAL_STORAGE_SIGNING_SECRET or JWT_SECRET must be set')
  }
  return secret
}

function getExpiryTimestamp(expiresInSeconds: number): number {
  return Math.floor(Date.now() / 1000) + Math.max(1, expiresInSeconds)
}

function signLocalStorageKey(key: string, expiresAt: number): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(`${key}:${expiresAt}`).digest('hex')
}

export function createLocalStorageSignedUrl(key: string, expiresInSeconds: number = 3600): string {
  const expiresAt = getExpiryTimestamp(expiresInSeconds)
  const params = new URLSearchParams({
    key,
    expires: String(expiresAt),
    sig: signLocalStorageKey(key, expiresAt),
  })

  return `${LOCAL_STORAGE_ROUTE_PATH}?${params.toString()}`
}

export function isValidLocalStorageSignedUrl(params: Pick<URLSearchParams, 'get'>): boolean {
  const key = params.get('key')
  const expiresRaw = params.get('expires')
  const signature = params.get('sig')

  if (!key || !expiresRaw || !signature) {
    return false
  }

  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false
  }

  const expected = signLocalStorageKey(key, expiresAt)
  const providedBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}
