import {
  getApiEndpoint,
  setApiEndpoint,
  isExtensionEnabled,
  setExtensionEnabled,
  getBlockedWebsites,
  setBlockedWebsites,
  isMemoryInjectionEnabled,
  setMemoryInjectionEnabled,
} from '../services/storage-service'
import { isWebsiteBlocked } from '../services/api-service'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'

export function handleSettingsMessage(
  message: {
    type?: string
    endpoint?: string
    enabled?: boolean
    websites?: string[]
    website?: string
    url?: string
  },
  sendResponse: (response: unknown) => void
): boolean {
  if (message?.type === MESSAGE_TYPES.SET_ENDPOINT && message.endpoint) {
    setApiEndpoint(message.endpoint)
      .then(() => {
        sendResponse({ success: true, message: 'API endpoint updated' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.GET_ENDPOINT) {
    getApiEndpoint()
      .then(endpoint => {
        sendResponse({ success: true, endpoint })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.GET_EXTENSION_ENABLED) {
    isExtensionEnabled()
      .then(enabled => {
        sendResponse({ success: true, enabled })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (
    message?.type === MESSAGE_TYPES.SET_EXTENSION_ENABLED &&
    typeof message.enabled === 'boolean'
  ) {
    ;(async () => {
      try {
        await setExtensionEnabled(message.enabled!)
        sendResponse({ success: true, message: 'Extension state updated' })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update extension state',
        })
      }
    })()
    return true
  }

  if (message?.type === MESSAGE_TYPES.GET_BLOCKED_WEBSITES) {
    getBlockedWebsites()
      .then(websites => {
        sendResponse({ success: true, websites })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (
    message?.type === MESSAGE_TYPES.SET_BLOCKED_WEBSITES &&
    Array.isArray((message as any).websites)
  ) {
    setBlockedWebsites((message as any).websites)
      .then(() => {
        sendResponse({ success: true, message: 'Blocked websites updated' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.ADD_BLOCKED_WEBSITE && (message as any).website) {
    getBlockedWebsites()
      .then(websites => {
        const website = (message as any).website.trim()
        if (website && !websites.includes(website)) {
          websites.push(website)
          return setBlockedWebsites(websites)
        }
        return Promise.resolve()
      })
      .then(() => {
        sendResponse({ success: true, message: 'Website added to blocked list' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.REMOVE_BLOCKED_WEBSITE && (message as any).website) {
    getBlockedWebsites()
      .then(websites => {
        const website = (message as any).website.trim()
        const filtered = websites.filter(w => w !== website)
        return setBlockedWebsites(filtered)
      })
      .then(() => {
        sendResponse({ success: true, message: 'Website removed from blocked list' })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.CHECK_WEBSITE_BLOCKED && (message as any).url) {
    isWebsiteBlocked((message as any).url)
      .then(blocked => {
        sendResponse({ success: true, blocked })
      })
      .catch(error => {
        sendResponse({ success: false, blocked: false, error: error.message })
      })
    return true
  }

  if (message?.type === MESSAGE_TYPES.GET_MEMORY_INJECTION_ENABLED) {
    isMemoryInjectionEnabled()
      .then(enabled => {
        sendResponse({ success: true, enabled })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (
    message?.type === MESSAGE_TYPES.SET_MEMORY_INJECTION_ENABLED &&
    typeof message.enabled === 'boolean'
  ) {
    ;(async () => {
      try {
        await setMemoryInjectionEnabled(message.enabled!)
        sendResponse({ success: true, message: 'Memory injection state updated' })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update memory injection state',
        })
      }
    })()
    return true
  }

  return false
}
