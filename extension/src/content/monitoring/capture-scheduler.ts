import { hasContentChanged, updateLastContent } from './content-monitor'
import {
  hasActivity,
  resetActivity,
  getLastActivityTime,
  getMonitoringInterval,
  updateActivityLevel,
} from './activity-tracker'
import { captureContext } from '../extraction/content-extractor'
import { runtime } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import { getPrivacyExtensionInfo } from '../privacy/privacy-detector'

const MIN_CAPTURE_INTERVAL = 10000
const ACTIVITY_TIMEOUT = 30000

let lastCaptureTime = 0
let captureInterval: ReturnType<typeof setInterval> | null = null
let isActive = true

export function getLastCaptureTime(): number {
  return lastCaptureTime
}

export function setLastCaptureTime(time: number) {
  lastCaptureTime = time
}

export function isMonitoring(): boolean {
  return !!captureInterval
}

export function getIsActive(): boolean {
  return isActive
}

export function setIsActive(active: boolean) {
  isActive = active
}

function shouldCaptureBasedOnActivity(): boolean {
  const now = Date.now()
  const timeSinceLastActivity = now - getLastActivityTime()
  const timeSinceLastCapture = now - lastCaptureTime
  return (
    hasActivity() &&
    timeSinceLastCapture >= MIN_CAPTURE_INTERVAL &&
    (hasContentChanged() || timeSinceLastActivity >= ACTIVITY_TIMEOUT)
  )
}

async function sendContextToBackground() {
  try {
    if (!runtime.id) {
      return
    }

    const now = Date.now()
    if (now - lastCaptureTime < MIN_CAPTURE_INTERVAL) {
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
    lastCaptureTime = now
  } catch (_error) {}
}

export function startContinuousMonitoring() {
  if (captureInterval) {
    clearInterval(captureInterval)
  }
  updateActivityLevel()
  const interval = getMonitoringInterval()
  captureInterval = setInterval(() => {
    if (!runtime.id) {
      stopContinuousMonitoring()
      return
    }
    if (isActive) {
      updateActivityLevel()
      if (shouldCaptureBasedOnActivity()) {
        sendContextToBackground()
        resetActivity()
        if (Date.now() - lastCaptureTime < 1000) {
          updateLastContent()
        }
      }
      const newInterval = getMonitoringInterval()
      if (newInterval !== interval) {
        startContinuousMonitoring()
      }
    }
  }, interval)
}

export function stopContinuousMonitoring() {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}
