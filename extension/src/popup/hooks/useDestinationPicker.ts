import { useCallback, useEffect, useState } from 'react'
import { runtime, storage } from '@/lib/browser'
import { STORAGE_KEYS, MESSAGE_TYPES } from '@/utils/core/constants.util'
import type { CaptureTarget, DestinationsPayload } from '@/types/destinations.types'
import { getApiEndpoint } from '@/background/services/storage-service'
import { requireAuthToken } from '@/utils/auth'

// Org-only model: a null/null target means "no destination chosen yet";
// the popup surfaces an empty-state message and the api-service refuses
// to send any auto-capture until the user picks one.
const UNSET: CaptureTarget = { organizationId: null, workspaceId: null }

interface SendMessageResponse {
  success?: boolean
  data?: DestinationsPayload
  error?: string
}

function sendBackgroundMessage(message: { type: string }): Promise<SendMessageResponse> {
  return new Promise(resolve => {
    runtime.sendMessage(message, (response: SendMessageResponse) => {
      resolve(response ?? { success: false })
    })
  })
}

async function readSyncDefault(): Promise<CaptureTarget> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.CAPTURE_TARGET_DEFAULT])
    const value = result[STORAGE_KEYS.CAPTURE_TARGET_DEFAULT] as CaptureTarget | undefined
    if (!value) return UNSET
    return {
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : null,
      workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    }
  } catch {
    return UNSET
  }
}

async function readSessionOverride(): Promise<CaptureTarget | null> {
  try {
    const result = await storage.session.get([STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE])
    const value = result[STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE] as CaptureTarget | undefined
    if (!value) return null
    return {
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : null,
      workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    }
  } catch {
    return null
  }
}

interface UseDestinationPickerResult {
  destinations: DestinationsPayload | null
  effectiveTarget: CaptureTarget
  syncDefault: CaptureTarget
  sessionOverride: CaptureTarget | null
  isLoading: boolean
  loadError: string | null
  selectOnce: (target: CaptureTarget) => Promise<void>
  selectAsDefault: (target: CaptureTarget) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Loads the user's destination tree, current saved default and session
 * override, and exposes setters for picker interactions.
 *
 * If the destinations fetch fails (offline, server down, etc.) we surface
 * a loadError. The picker shows an empty-state message; capture is paused
 * until destinations come back, since Cognia is org-only and there is no
 * personal vault to fall back to.
 */
export function useDestinationPicker(): UseDestinationPickerResult {
  const [destinations, setDestinations] = useState<DestinationsPayload | null>(null)
  const [syncDefault, setSyncDefaultState] = useState<CaptureTarget>(UNSET)
  const [sessionOverride, setSessionOverrideState] = useState<CaptureTarget | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const [def, override, response] = await Promise.all([
      readSyncDefault(),
      readSessionOverride(),
      sendBackgroundMessage({ type: MESSAGE_TYPES.GET_DESTINATIONS }),
    ])
    setSyncDefaultState(def)
    setSessionOverrideState(override)
    if (response?.success && response.data) {
      setDestinations(response.data)
    } else {
      setLoadError(response?.error ?? 'failed to load destinations')
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadAll().catch(() => {
      setLoadError('unexpected error loading destinations')
      setIsLoading(false)
    })
  }, [loadAll])

  const selectOnce = useCallback(async (target: CaptureTarget) => {
    await storage.session.set({ [STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE]: target })
    setSessionOverrideState(target)
  }, [])

  const selectAsDefault = useCallback(async (target: CaptureTarget) => {
    // Persist locally first so the popup updates immediately even if the
    // server call lags or fails. The web preference will sync on next load.
    await storage.sync.set({ [STORAGE_KEYS.CAPTURE_TARGET_DEFAULT]: target })
    await storage.session.set({ [STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE]: target })
    setSyncDefaultState(target)
    setSessionOverrideState(target)

    try {
      const endpoint = await getApiEndpoint()
      const baseUrl = new URL(endpoint)
      const token = await requireAuthToken()
      await fetch(`${baseUrl.protocol}//${baseUrl.host}/api/profile/capture-destination`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(target),
      })
    } catch {
      // The local default is already persisted; web sync will retry on next
      // app load. We intentionally don't surface this error to the picker.
    }
  }, [])

  const effectiveTarget: CaptureTarget = sessionOverride ?? syncDefault

  return {
    destinations,
    effectiveTarget,
    syncDefault,
    sessionOverride,
    isLoading,
    loadError,
    selectOnce,
    selectAsDefault,
    refresh: loadAll,
  }
}
