import { tabs } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'

function isValidContentScriptUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

export function setupTabListeners(): void {
  if (tabs.onActivated) {
    tabs.onActivated.addListener(async activeInfo => {
      try {
        const tab = await tabs.query({ active: true, currentWindow: true })
        if (tab.length > 0 && isValidContentScriptUrl(tab[0].url)) {
          tabs.sendMessage(activeInfo.tabId, {
            type: MESSAGE_TYPES.CAPTURE_CONTEXT_NOW,
          })
        }
      } catch (_error) {}
    })
  }

  if (tabs.onUpdated) {
    tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && isValidContentScriptUrl(tab.url)) {
        try {
          tabs.sendMessage(tabId, { type: MESSAGE_TYPES.CAPTURE_CONTEXT_NOW })
        } catch (_error) {}
      }
    })
  }
}
