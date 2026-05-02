import { storage } from '@/lib/browser'
import { getApiEndpoint } from './storage-service'
import { requireAuthToken } from '@/utils/auth'
import { getUserId } from '@/lib/userId'
import { STORAGE_KEYS } from '@/utils/core/constants.util'
import type { DestinationsPayload } from '@/types/destinations.types'

/**
 * Cache TTL: 5 minutes. Destination shape changes rarely (the user joined a
 * new org, or a workspace was created); a short TTL keeps the popup snappy
 * without making it stale for long.
 */
const CACHE_TTL_MS = 5 * 60 * 1000

interface CachedDestinations {
  data: DestinationsPayload
  fetched_at: number
}

function cacheKey(userId: string): string {
  return `${STORAGE_KEYS.DESTINATIONS_CACHE_PREFIX}${userId}`
}

async function deriveBaseUrl(): Promise<string> {
  const endpoint = await getApiEndpoint()
  const u = new URL(endpoint)
  return `${u.protocol}//${u.host}`
}

async function readCache(userId: string): Promise<CachedDestinations | null> {
  try {
    const result = await storage.local.get([cacheKey(userId)])
    const cached = result[cacheKey(userId)] as CachedDestinations | undefined
    if (!cached) return null
    if (Date.now() - cached.fetched_at > CACHE_TTL_MS) return null
    return cached
  } catch {
    return null
  }
}

async function writeCache(userId: string, data: DestinationsPayload): Promise<void> {
  try {
    const entry: CachedDestinations = { data, fetched_at: Date.now() }
    await storage.local.set({ [cacheKey(userId)]: entry })
  } catch {
    // best-effort; cache failures should not break capture
  }
}

async function invalidateCache(userId: string): Promise<void> {
  try {
    await storage.local.remove(cacheKey(userId))
  } catch {
    // ignore
  }
}

/**
 * Fetch the user's destinations from the API. Returns the cached payload if
 * fresh; otherwise fetches and caches. Throws on network/auth failure — the
 * popup is responsible for handling that and falling back to "Personal".
 */
export async function getDestinations(
  options: { forceRefresh?: boolean } = {}
): Promise<DestinationsPayload> {
  const userId = await getUserId()

  if (!options.forceRefresh) {
    const cached = await readCache(userId)
    if (cached) return cached.data
  }

  const baseUrl = await deriveBaseUrl()
  const token = await requireAuthToken()
  const url = `${baseUrl}/api/extension/destinations`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`destinations fetch failed: ${response.status}`)
    }

    const json = (await response.json()) as { success: boolean; data: DestinationsPayload }
    if (!json?.success || !json.data) {
      throw new Error('destinations response missing data')
    }
    await writeCache(userId, json.data)
    return json.data
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

/**
 * Trigger a fresh fetch and cache write. Useful after auth changes (the user
 * just logged in) or after the picker writes a new default.
 */
export async function refreshDestinations(): Promise<DestinationsPayload | null> {
  try {
    return await getDestinations({ forceRefresh: true })
  } catch {
    // best-effort; the picker can fall back to whatever is cached or to
    // Personal-only.
    return null
  }
}

export async function clearDestinationsCache(): Promise<void> {
  try {
    const userId = await getUserId()
    await invalidateCache(userId)
  } catch {
    // ignore
  }
}
