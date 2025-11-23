import { sendToBackend } from '../services/api-service'
import { storage } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import type { ContextData } from '@/types/background.types'

export function handleCaptureContext(
  message: { type?: string; data?: ContextData },
  sendResponse: (response: unknown) => void
): boolean {
  if (message?.type === MESSAGE_TYPES.CAPTURE_CONTEXT && message.data) {
    sendToBackend(message.data)
      .then(() => {
        storage.local.set({ last_capture_time: Date.now() })
        sendResponse({ success: true, message: 'Context sent to backend' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })

    return true
  }
  return false
}
