import { encryptString, decryptString } from '../../utils/auth/crypto.util'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

/**
 * Slim in-house Google Calendar OAuth + event-create service.
 *
 * Reuses the existing UserIntegration table with provider='google_calendar'
 * to store the encrypted OAuth token. Tokens are encrypted via the same
 * TOKEN_ENCRYPTION_KEY env var the integrations service uses (AES-256-GCM
 * via api/src/utils/auth/crypto.util).
 *
 * If GOOGLE_CALENDAR_CLIENT_ID / SECRET are unset, the service is exported
 * as `isCalendarConnected = false` and getAuthUrl throws — the route layer
 * surfaces this as 503 rather than crashing on boot.
 */

const PROVIDER = 'google_calendar' as const

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

interface GoogleEventResponse {
  id: string
  htmlLink: string
  status?: string
}

export interface CreateCalendarEventArgs {
  summary: string
  description?: string
  start: Date
  end: Date
  attendees?: string[]
  timeZone?: string
}

export interface CreateCalendarEventResult {
  eventId: string
  htmlLink: string
}

function getClientId(): string | undefined {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID
}

function getClientSecret(): string | undefined {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET
}

function getRedirectUri(): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    'https://api.cogniahq.tech/api/calendar/auth/callback'
  )
}

function isConfigured(): boolean {
  return Boolean(getClientId() && getClientSecret())
}

function requireEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY required for Google Calendar token storage')
  }
  return key
}

class CalendarConfigError extends Error {
  constructor() {
    super(
      'Google Calendar is not configured (set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET).'
    )
    this.name = 'CalendarConfigError'
  }
}

class CalendarNotConnectedError extends Error {
  constructor() {
    super('User has not connected Google Calendar.')
    this.name = 'CalendarNotConnectedError'
  }
}

export const googleCalendarService = {
  isCalendarConfigured: isConfigured,
  CalendarConfigError,
  CalendarNotConnectedError,

  /**
   * Build the consent-screen URL the client should redirect the user to.
   * `state` round-trips through Google's redirect; encode the user-id in it
   * (the route layer signs/verifies via createOAuthState).
   */
  getAuthUrl(state: string): string {
    if (!isConfigured()) throw new CalendarConfigError()
    const params = new URLSearchParams({
      client_id: getClientId()!,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: CALENDAR_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })
    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  },

  /**
   * Exchange an authorization code for tokens and persist them as a
   * UserIntegration row with provider='google_calendar'.
   */
  async handleCallback(args: { code: string; userId: string }): Promise<void> {
    if (!isConfigured()) throw new CalendarConfigError()
    const tokens = await exchangeCodeForTokens(args.code)
    const key = requireEncryptionKey()
    const encryptedAccess = encryptString(tokens.access_token, key)
    const encryptedRefresh = tokens.refresh_token
      ? encryptString(tokens.refresh_token, key)
      : null
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    await prisma.userIntegration.upsert({
      where: {
        user_id_provider: {
          user_id: args.userId,
          provider: PROVIDER,
        },
      },
      create: {
        user_id: args.userId,
        provider: PROVIDER,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_expires_at: expiresAt,
      },
      update: {
        access_token: encryptedAccess,
        // Don't blow away an existing refresh token if Google omits one
        // on a re-consent (it sometimes does).
        ...(encryptedRefresh ? { refresh_token: encryptedRefresh } : {}),
        token_expires_at: expiresAt,
        status: 'ACTIVE',
        last_error: null,
      },
    })
  },

  /**
   * Whether this user has an active google_calendar UserIntegration row.
   */
  async getConnectionStatus(userId: string): Promise<{ connected: boolean; configured: boolean }> {
    if (!isConfigured()) {
      return { connected: false, configured: false }
    }
    const row = await prisma.userIntegration.findUnique({
      where: {
        user_id_provider: { user_id: userId, provider: PROVIDER },
      },
      select: { id: true, status: true },
    })
    return {
      configured: true,
      connected: Boolean(row && row.status !== 'DISCONNECTED'),
    }
  },

  /**
   * Disconnect by deleting the UserIntegration row.
   */
  async disconnect(userId: string): Promise<void> {
    await prisma.userIntegration.deleteMany({
      where: { user_id: userId, provider: PROVIDER },
    })
  },

  /**
   * Create an event on the user's primary Google Calendar.
   * Refreshes the access token transparently if expired.
   */
  async createEvent(
    userId: string,
    args: CreateCalendarEventArgs
  ): Promise<CreateCalendarEventResult> {
    if (!isConfigured()) throw new CalendarConfigError()

    const accessToken = await getValidAccessToken(userId)

    const body = {
      summary: args.summary,
      description: args.description,
      start: { dateTime: args.start.toISOString(), timeZone: args.timeZone || 'UTC' },
      end: { dateTime: args.end.toISOString(), timeZone: args.timeZone || 'UTC' },
      attendees: (args.attendees || []).map(email => ({ email })),
    }

    const res = await fetch(GOOGLE_EVENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      logger.warn('[google-calendar] event create failed', {
        userId,
        status: res.status,
        body: text.slice(0, 500),
      })
      throw new Error(`Google Calendar API error: ${res.status}`)
    }

    const json = (await res.json()) as GoogleEventResponse
    return { eventId: json.id, htmlLink: json.htmlLink }
  },
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: getClientId()!,
    client_secret: getClientSecret()!,
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as GoogleTokenResponse
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: getClientId()!,
    client_secret: getClientSecret()!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token refresh failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as GoogleTokenResponse
}

async function getValidAccessToken(userId: string): Promise<string> {
  const row = await prisma.userIntegration.findUnique({
    where: { user_id_provider: { user_id: userId, provider: PROVIDER } },
  })
  if (!row) {
    throw new googleCalendarService.CalendarNotConnectedError()
  }
  const key = requireEncryptionKey()
  const accessToken = decryptString(row.access_token, key)
  const refreshToken = row.refresh_token ? decryptString(row.refresh_token, key) : null

  const expiresAt = row.token_expires_at?.getTime() ?? 0
  const stillValid = expiresAt > Date.now() + 60_000 // 1-minute buffer
  if (stillValid) {
    return accessToken
  }
  if (!refreshToken) {
    // Token is expired and we don't have a refresh token. Mark and bubble up.
    await prisma.userIntegration.update({
      where: { id: row.id },
      data: { status: 'TOKEN_EXPIRED', last_error: 'No refresh token available' },
    })
    throw new googleCalendarService.CalendarNotConnectedError()
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken)
    const newAccess = refreshed.access_token
    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null
    await prisma.userIntegration.update({
      where: { id: row.id },
      data: {
        access_token: encryptString(newAccess, key),
        token_expires_at: newExpiresAt,
        status: 'ACTIVE',
        last_error: null,
      },
    })
    return newAccess
  } catch (err) {
    await prisma.userIntegration.update({
      where: { id: row.id },
      data: {
        status: 'TOKEN_EXPIRED',
        last_error: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}
