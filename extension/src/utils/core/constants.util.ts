import { env } from './env.util'

export const DEFAULT_API_ENDPOINT = env.API_ENDPOINT
export const DEFAULT_API_BASE = env.API_BASE_URL
export const MIN_CAPTURE_INTERVAL = 10000
export const ACTIVITY_TIMEOUT = 30000
export const CONTENT_CHANGE_THRESHOLD = 0.1
export const MIN_CONTENT_LENGTH = 50
export const MEMORY_INJECTION_DELAY = 1500
export const MEMORY_INJECTION_MIN_LENGTH = 3

export const MESSAGE_TYPES = {
  CAPTURE_CONTEXT: 'CAPTURE_CONTEXT',
  CAPTURE_CONTEXT_NOW: 'CAPTURE_CONTEXT_NOW',
  // Manual capture trigger fired by the popup. Unlike CAPTURE_CONTEXT_NOW
  // (which is sent automatically by the tab listener on activation/update),
  // this signals an explicit user request and respects the destination
  // picker's session override.
  CAPTURE_CONTEXT_MANUAL: 'CAPTURE_CONTEXT_MANUAL',
  // Background-only message asking the extension to refresh the cached
  // destinations list. Fired after auth changes or after the picker writes a
  // new default.
  REFRESH_DESTINATIONS: 'REFRESH_DESTINATIONS',
  GET_DESTINATIONS: 'GET_DESTINATIONS',
  SET_ENDPOINT: 'SET_ENDPOINT',
  GET_ENDPOINT: 'GET_ENDPOINT',
  GET_EXTENSION_ENABLED: 'GET_EXTENSION_ENABLED',
  SET_EXTENSION_ENABLED: 'SET_EXTENSION_ENABLED',
  GET_MEMORY_INJECTION_ENABLED: 'GET_MEMORY_INJECTION_ENABLED',
  SET_MEMORY_INJECTION_ENABLED: 'SET_MEMORY_INJECTION_ENABLED',
  GET_BLOCKED_WEBSITES: 'GET_BLOCKED_WEBSITES',
  SET_BLOCKED_WEBSITES: 'SET_BLOCKED_WEBSITES',
  ADD_BLOCKED_WEBSITE: 'ADD_BLOCKED_WEBSITE',
  REMOVE_BLOCKED_WEBSITE: 'REMOVE_BLOCKED_WEBSITE',
  CHECK_WEBSITE_BLOCKED: 'CHECK_WEBSITE_BLOCKED',
  CHECK_API_HEALTH: 'CHECK_API_HEALTH',
  SYNC_AUTH_TOKEN: 'SYNC_AUTH_TOKEN',
  PING: 'PING',
  DRAFT_EMAIL_REPLY: 'DRAFT_EMAIL_REPLY',
} as const

export const STORAGE_KEYS = {
  API_ENDPOINT: 'apiEndpoint',
  EXTENSION_ENABLED: 'extensionEnabled',
  MEMORY_INJECTION_ENABLED: 'memoryInjectionEnabled',
  BLOCKED_WEBSITES: 'blockedWebsites',
  AUTH_TOKEN: 'auth_token',
  // Default capture destination, persisted via chrome.storage.sync so it
  // follows the user across browsers/devices that share Chrome sync. Stored
  // shape: { organizationId: string | null, workspaceId: string | null }.
  // Null/null = no default chosen; the popup prompts the user.
  CAPTURE_TARGET_DEFAULT: 'capture_target_default',
  // Per-capture override stored in chrome.storage.session — wiped each time
  // the browser session ends, so the override never silently outlives the
  // user's intent.
  CAPTURE_TARGET_OVERRIDE: 'capture_target_override',
  // Cached destinations payload from /api/extension/destinations, scoped to
  // the user. Shape: { data, fetched_at }.
  DESTINATIONS_CACHE_PREFIX: 'destinations_cache:',
  // DLP block telemetry — incremented every time client-side DLP drops a
  // capture, surfaced in the popup status section.
  DLP_BLOCK_COUNT: 'dlp_block_count',
  DLP_LAST_BLOCKED_AT: 'dlp_last_blocked_at',
} as const
