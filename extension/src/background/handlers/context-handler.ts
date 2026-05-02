import { sendToBackend } from '../services/api-service'
import { clearSessionOverride } from '../services/capture-target.service'
import { storage, tabs } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import type { ContextData } from '@/types/background.types'

export function handleCaptureContext(
  message: { type?: string; data?: ContextData },
  sendResponse: (response: unknown) => void
): boolean {
  if (message?.type === MESSAGE_TYPES.CAPTURE_CONTEXT && message.data) {
    const data = message.data
    const wasManualOverride =
      (data as { auto_capture?: boolean }).auto_capture !== true
    sendToBackend(data)
      .then(async () => {
        storage.local.set({ last_capture_time: Date.now() })
        // Per-capture session override is one-shot: clear after the first
        // capture that consumed it so subsequent auto/manual captures fall
        // back to the user's saved default.
        if (wasManualOverride) {
          await clearSessionOverride().catch(() => {})
        }
        sendResponse({ success: true, message: 'Context sent to backend' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })

    return true
  }

  // Manual capture path: popup asked for an explicit capture. Forward to the
  // active tab's content script so it builds a payload and posts it back via
  // CAPTURE_CONTEXT (without setting auto_capture=true). The destination
  // picker's session override applies here.
  if (message?.type === MESSAGE_TYPES.CAPTURE_CONTEXT_MANUAL) {
    ;(async () => {
      try {
        const activeTabs = await tabs.query({ active: true, currentWindow: true })
        const tab = activeTabs[0]
        if (!tab?.id) {
          sendResponse({ success: false, error: 'no active tab' })
          return
        }
        tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.CAPTURE_CONTEXT_NOW, manual: true })
        sendResponse({ success: true })
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message })
      }
    })()
    return true
  }

  return false
}
