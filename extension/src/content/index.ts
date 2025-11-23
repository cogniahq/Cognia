import { runtime } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import { detectPrivacyExtensions, getPrivacyExtensionInfo } from './privacy/privacy-detector'
import { captureContext } from './extraction/content-extractor'
import {
  startContinuousMonitoring,
  stopContinuousMonitoring,
  setIsActive,
} from './monitoring/capture-scheduler'
import { markUserActivity } from './monitoring/activity-tracker'
import { initEmailDraftPill } from './email/email-draft'
import { initAIChatIntegration } from './ai-chat/chat-integration'

function isLocalhost(): boolean {
  const hostname = window.location.hostname
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  )
}

async function checkExtensionEnabled(): Promise<boolean> {
  try {
    return new Promise(resolve => {
      runtime.sendMessage({ type: MESSAGE_TYPES.GET_EXTENSION_ENABLED }, (response: any) => {
        resolve(response?.success ? response.enabled : true)
      })
    })
  } catch (error) {
    console.error('Cognia: Error checking extension enabled state:', error)
    return true
  }
}

async function checkWebsiteBlocked(url: string): Promise<boolean> {
  try {
    return new Promise(resolve => {
      runtime.sendMessage(
        { type: MESSAGE_TYPES.CHECK_WEBSITE_BLOCKED, url: url },
        (response: any) => {
          resolve(response?.success ? response.blocked : false)
        }
      )
    })
  } catch (_error) {
    return false
  }
}

async function sendContextToBackground() {
  try {
    if (!runtime.id) {
      return
    }

    if (isLocalhost()) {
      return
    }

    const enabled = await checkExtensionEnabled()
    if (!enabled) {
      return
    }

    const currentUrl = window.location.href
    const isBlocked = await checkWebsiteBlocked(currentUrl)
    if (isBlocked) {
      return
    }

    const contextData = captureContext()

    const hasValidContent =
      contextData.content_snippet &&
      contextData.content_snippet.length > 50 &&
      !contextData.content_snippet.includes('Content extraction failed')

    const privacyInfo = getPrivacyExtensionInfo()
    if (privacyInfo.detected && !hasValidContent) {
      return
    }

    if (!hasValidContent) {
      return
    }

    ;(contextData as any).privacy_extension_info = privacyInfo
    runtime.sendMessage({ type: MESSAGE_TYPES.CAPTURE_CONTEXT, data: contextData }, _response => {
      // Capture sent silently
    })
  } catch (_error) {}
}

;(window as any).pageLoadTime = Date.now()
;(window as any).interactionCount = 0
detectPrivacyExtensions()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    markUserActivity()
    if (!isLocalhost()) {
      sendContextToBackground()
    }
  })
} else {
  markUserActivity()
  if (!isLocalhost()) {
    sendContextToBackground()
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    markUserActivity()
  }
})

window.addEventListener('focus', () => {
  markUserActivity()
})

runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (!runtime.id) {
    return false
  }
  if (message.type === MESSAGE_TYPES.CAPTURE_CONTEXT_NOW) {
    markUserActivity()
    if (!isLocalhost()) {
      sendContextToBackground()
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, reason: 'localhost detected' })
    }
    return true
  }
  if (message.type === 'START_MONITORING') {
    if (!isLocalhost()) {
      startContinuousMonitoring()
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, reason: 'localhost detected' })
    }
    return true
  }
  if (message.type === 'STOP_MONITORING') {
    stopContinuousMonitoring()
    sendResponse({ success: true })
    return true
  }
  if (message.type === 'GET_MONITORING_STATUS') {
    const captureScheduler = await import('./monitoring/capture-scheduler')
    sendResponse({
      success: true,
      isActive: captureScheduler.getIsActive(),
      isMonitoring: captureScheduler.isMonitoring(),
    })
    return true
  }
})

startContinuousMonitoring()

new MutationObserver(async () => {
  const url = location.href
  const { updateLastContent } = await import('./monitoring/content-monitor')
  if (url !== location.href) {
    updateLastContent()
    if (!isLocalhost()) {
      setTimeout(sendContextToBackground, 1000)
    }
  }
}).observe(document, { subtree: true, childList: true })

document.addEventListener('visibilitychange', () => {
  setIsActive(!document.hidden)
  if (!document.hidden) {
    startContinuousMonitoring()
  } else {
    stopContinuousMonitoring()
  }
})

window.addEventListener('blur', () => {
  setIsActive(false)
  stopContinuousMonitoring()
})

window.addEventListener('focus', () => {
  setIsActive(true)
  startContinuousMonitoring()
})

document.addEventListener('click', () => {
  markUserActivity()
  ;(window as any).interactionCount++
})

document.addEventListener('scroll', () => {
  markUserActivity()
  ;(window as any).interactionCount++
})

document.addEventListener('keydown', () => {
  markUserActivity()
  ;(window as any).interactionCount++
})

let mouseMoveTimeout: ReturnType<typeof setTimeout> | null = null
document.addEventListener('mousemove', () => {
  if (mouseMoveTimeout) return
  mouseMoveTimeout = setTimeout(() => {
    markUserActivity()
    mouseMoveTimeout = null
  }, 3000)
})

document.addEventListener(
  'input',
  e => {
    const target = e.target as HTMLElement
    if (
      target &&
      (target.contentEditable === 'true' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('[data-testid*="textbox"]') ||
        target.closest('div[contenteditable="true"]') ||
        target.closest('div[role="textbox"]'))
    ) {
      markUserActivity()
    }
  },
  true
)

document.addEventListener(
  'keyup',
  e => {
    const target = e.target as HTMLElement
    if (
      target &&
      (target.contentEditable === 'true' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('[data-testid*="textbox"]') ||
        target.closest('div[contenteditable="true"]') ||
        target.closest('div[role="textbox"]'))
    ) {
      markUserActivity()
    }
  },
  true
)

initAIChatIntegration()
initEmailDraftPill()
