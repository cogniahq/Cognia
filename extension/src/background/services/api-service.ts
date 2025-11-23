import { getApiEndpoint } from './storage-service'
import { DEFAULT_API_BASE } from '@/utils/core/constants.util'
import { requireAuthToken, clearAuthToken } from '@/utils/auth'
import { storage } from '@/lib/browser'
import { STORAGE_KEYS } from '@/utils/core/constants.util'
import type { ContextData, EmailDraftPayload } from '@/types/background.types'

async function getApiBaseUrl(): Promise<string> {
  try {
    const endpoint = await getApiEndpoint()
    const url = new URL(endpoint)
    return `${url.protocol}//${url.host}`
  } catch (_error) {
    return DEFAULT_API_BASE
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const apiBase = await getApiBaseUrl()
    const healthUrl = `${apiBase}/health`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        credentials: 'include',
      })
      clearTimeout(timeout)
      return response.ok || response.status < 500
    } catch (_error) {
      clearTimeout(timeout)
      try {
        const searchUrl = `${apiBase}/api/search`
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'health-check', limit: 1 }),
          signal: controller.signal,
          credentials: 'include',
        })
        return searchResponse.status < 500
      } catch {
        return false
      }
    }
  } catch (_error) {
    return false
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch (_error) {
    return ''
  }
}

export async function isWebsiteBlocked(url: string): Promise<boolean> {
  const { getBlockedWebsites } = await import('./storage-service')
  try {
    const blockedWebsites = await getBlockedWebsites()
    if (blockedWebsites.length === 0) {
      return false
    }

    const domain = extractDomain(url)
    if (!domain) {
      return false
    }

    return blockedWebsites.some(blocked => {
      const blockedDomain = extractDomain(blocked)
      if (!blockedDomain) {
        return url.includes(blocked) || blocked.includes(url)
      }
      return (
        domain === blockedDomain ||
        domain.endsWith('.' + blockedDomain) ||
        blockedDomain.endsWith('.' + domain)
      )
    })
  } catch (_error) {
    return false
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      controller.signal.aborted ? reject(new DOMException('Aborted', 'AbortError')) : undefined
    ),
  ]).finally(() => clearTimeout(timeout)) as Promise<T>
}

export async function requestEmailDraft(payload: EmailDraftPayload) {
  const apiBase = await getApiBaseUrl()
  const endpoint = `${apiBase}/api/content/email/draft`

  let authToken: string
  try {
    authToken = await requireAuthToken()
  } catch (_error) {
    throw new Error('Authentication required. Please log in through the Cognia web client.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 370000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Draft request failed (${response.status}): ${errorText || response.statusText}`
      )
    }

    const result = await response.json()
    if (!result?.success || !result.data) {
      throw new Error('Draft service returned an unexpected response.')
    }

    return result.data as { subject: string; body: string; summary?: string }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - email draft took too long to generate')
    }
    throw error
  }
}

export async function sendToBackend(data: ContextData): Promise<void> {
  const { isExtensionEnabled } = await import('./storage-service')
  try {
    const enabled = await isExtensionEnabled()
    if (!enabled) {
      return
    }

    const blocked = await isWebsiteBlocked(data.url)
    if (blocked) {
      return
    }

    const apiEndpoint = await getApiEndpoint()

    const privacyInfo = (data as any).privacy_extension_info
    const hasPrivacyConflicts = privacyInfo?.detected || false

    const content = data.meaningful_content || data.content_snippet || data.full_content || ''
    const isValidContent =
      content &&
      content.length > 50 &&
      !content.includes('Content extraction failed') &&
      !content.includes('No content available') &&
      !content.includes('[REDACTED:')

    if (!isValidContent) {
      return
    }

    const { getUserId } = await import('@/lib/userId')
    let userId: string
    try {
      userId = await getUserId()
    } catch (_error) {
      return
    }

    const payload = {
      content: content,
      url: data.url,
      title: data.title,
      userId: userId,
      metadata: {
        source: data.source,
        timestamp: data.timestamp,
        content_type: data.content_type || 'web_page',
        content_summary: data.content_summary,
        privacy_extension_conflicts: hasPrivacyConflicts,
        privacy_extension_type: privacyInfo?.type || 'none',
        compatibility_mode: privacyInfo?.compatibility_mode || false,
      },
    }

    let authToken: string
    try {
      authToken = await requireAuthToken()
    } catch (_error) {
      return
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    }

    const controller = new AbortController()
    const fetchPromise = fetch(apiEndpoint, {
      method: 'POST',
      headers,
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ ...payload, userId: userId }),
      signal: controller.signal,
    })

    const response = await withTimeout(fetchPromise, 4000).catch(_e => null)

    if (response && !response.ok) {
      if (response.status === 401) {
        await storage.local.remove(STORAGE_KEYS.AUTH_TOKEN)
        clearAuthToken()
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (_error) {}
}
