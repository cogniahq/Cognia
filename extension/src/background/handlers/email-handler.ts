import { requestEmailDraft } from '../services/api-service'
import type { EmailDraftPayload } from '@/types/background.types'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'

export function handleEmailDraft(
  message: {
    type?: string
    payload?: EmailDraftPayload
  },
  sendResponse: (response: unknown) => void
): boolean {
  if (message?.type === MESSAGE_TYPES.DRAFT_EMAIL_REPLY) {
    const responseCallback = sendResponse
    let responseSent = false

    const safeSendResponse = (response: any) => {
      if (!responseSent) {
        responseSent = true
        try {
          responseCallback(response)
        } catch (err) {
          console.error('[Cognia] Error sending response:', err)
        }
      }
    }

    ;(async () => {
      try {
        const payload = (message as any).payload as EmailDraftPayload
        if (!payload || typeof payload.thread_text !== 'string') {
          safeSendResponse({ success: false, error: 'Invalid payload' })
          return
        }

        const data = await requestEmailDraft(payload)
        safeSendResponse({ success: true, data })
      } catch (error) {
        safeSendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to draft email reply',
        })
      }
    })()

    return true
  }
  return false
}
