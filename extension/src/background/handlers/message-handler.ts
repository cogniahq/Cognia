import { handleCaptureContext } from './context-handler'
import { handleSettingsMessage } from './settings-handler'
import { handleEmailDraft } from './email-handler'
import { checkApiHealth } from '../services/health-service'
import { storage } from '@/lib/browser'
import { STORAGE_KEYS, MESSAGE_TYPES } from '@/utils/core/constants.util'

export function handleMessage(
  message: {
    type?: string
    data?: unknown
    endpoint?: string
    enabled?: boolean
    websites?: string[]
    website?: string
    url?: string
    payload?: unknown
    token?: string
  },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  if (handleCaptureContext(message as any, sendResponse)) {
    return true
  }

  if (handleSettingsMessage(message as any, sendResponse)) {
    return true
  }

  if (handleEmailDraft(message as any, sendResponse)) {
    return true
  }

  if (message?.type === MESSAGE_TYPES.SYNC_AUTH_TOKEN) {
    ;(async () => {
      try {
        const token = (message as any).token
        if (token) {
          await storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: token })
        }
      } catch (_error) {}
    })()
  }

  if (message?.type === MESSAGE_TYPES.CHECK_API_HEALTH) {
    checkApiHealth()
      .then(healthy => {
        sendResponse({ success: true, healthy })
      })
      .catch(error => {
        sendResponse({ success: false, healthy: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.PING) {
    sendResponse({ type: 'PONG', from: 'background' })
  }

  return false
}
