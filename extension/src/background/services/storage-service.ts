import { storage } from '@/lib/browser'
import { STORAGE_KEYS, DEFAULT_API_ENDPOINT } from '@/utils/core/constants.util'

export async function getApiEndpoint(): Promise<string> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.API_ENDPOINT])
    return result[STORAGE_KEYS.API_ENDPOINT] || DEFAULT_API_ENDPOINT
  } catch (_error) {
    return DEFAULT_API_ENDPOINT
  }
}

export async function setApiEndpoint(endpoint: string): Promise<void> {
  try {
    await storage.sync.set({ [STORAGE_KEYS.API_ENDPOINT]: endpoint })
  } catch (_error) {
    console.error('Cognia: Error setting API endpoint:', _error)
  }
}

export async function isExtensionEnabled(): Promise<boolean> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.EXTENSION_ENABLED])
    return result[STORAGE_KEYS.EXTENSION_ENABLED] !== false
  } catch (_error) {
    return true
  }
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  try {
    await storage.sync.set({ [STORAGE_KEYS.EXTENSION_ENABLED]: enabled })
  } catch (_error) {
    if (_error instanceof Error) {
      throw _error
    }
    throw new Error('Failed to save extension state')
  }
}

export async function getBlockedWebsites(): Promise<string[]> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.BLOCKED_WEBSITES])
    return result[STORAGE_KEYS.BLOCKED_WEBSITES] || []
  } catch (_error) {
    return []
  }
}

export async function setBlockedWebsites(websites: string[]): Promise<void> {
  try {
    await storage.sync.set({ [STORAGE_KEYS.BLOCKED_WEBSITES]: websites })
  } catch (_error) {}
}

export async function isMemoryInjectionEnabled(): Promise<boolean> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.MEMORY_INJECTION_ENABLED])
    return result[STORAGE_KEYS.MEMORY_INJECTION_ENABLED] !== false
  } catch (_error) {
    return true
  }
}

export async function setMemoryInjectionEnabled(enabled: boolean): Promise<void> {
  try {
    await storage.sync.set({ [STORAGE_KEYS.MEMORY_INJECTION_ENABLED]: enabled })
  } catch (_error) {
    if (_error instanceof Error) {
      throw _error
    }
    throw new Error('Failed to save memory injection state')
  }
}
