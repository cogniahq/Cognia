import { getRedisClient } from '../../lib/redis.lib'

const JTI_PREFIX = 'jwt:revoked:jti:'
const USER_REVOKE_PREFIX = 'jwt:revoked:user:'
const USER_REVOKE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days; outlives the longest JWT TTL

/**
 * Mark a single JWT id as revoked. ttlMs should be at least the remaining
 * lifetime of the token; entries are auto-evicted at natural expiry to bound memory.
 */
export async function revokeJti(jti: string, ttlMs: number): Promise<void> {
  const redis = getRedisClient()
  await redis.set(JTI_PREFIX + jti, '1', 'PX', Math.max(ttlMs, 1000))
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
  const redis = getRedisClient()
  return (await redis.exists(JTI_PREFIX + jti)) === 1
}

/**
 * Revoke every JWT for a user issued at or before "now". Stored as a unix
 * timestamp; the auth middleware checks token.iat against this floor.
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  const redis = getRedisClient()
  const nowSeconds = Math.floor(Date.now() / 1000)
  await redis.set(USER_REVOKE_PREFIX + userId, String(nowSeconds), 'EX', USER_REVOKE_TTL_SECONDS)
}

/**
 * True if the user has a revoke-floor that is >= the token's iat
 * (i.e. token was issued at or before the revoke moment).
 */
export async function isUserRevokedSince(userId: string, tokenIat: number): Promise<boolean> {
  const redis = getRedisClient()
  const floor = await redis.get(USER_REVOKE_PREFIX + userId)
  if (!floor) return false
  return tokenIat <= Number(floor)
}
