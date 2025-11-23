import { useState, useEffect } from 'react'
import { runtime, tabs } from '@/lib/browser'

export function useExtensionSettings() {
  const [extensionEnabled, setExtensionEnabled] = useState(true)
  const [memoryInjectionEnabled, setMemoryInjectionEnabled] = useState(true)
  const [blockedWebsites, setBlockedWebsites] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSettings = async () => {
    try {
      const extensionResponse = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'GET_EXTENSION_ENABLED' }, resolve)
      })
      if (extensionResponse && extensionResponse.success) {
        setExtensionEnabled(extensionResponse.enabled)
      }

      const memoryInjectionResponse = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'GET_MEMORY_INJECTION_ENABLED' }, resolve)
      })
      if (memoryInjectionResponse && memoryInjectionResponse.success) {
        setMemoryInjectionEnabled(memoryInjectionResponse.enabled)
      }

      const blockedResponse = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'GET_BLOCKED_WEBSITES' }, resolve)
      })
      if (blockedResponse && blockedResponse.success) {
        setBlockedWebsites(blockedResponse.websites || [])
      }
    } catch (_error) {
      console.error('Error loading settings:', _error)
    }
  }

  const toggleExtension = async () => {
    setIsLoading(true)
    try {
      const newState = !extensionEnabled

      const response = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'SET_EXTENSION_ENABLED', enabled: newState }, resolve)
      })

      if (response && response.success) {
        setExtensionEnabled(newState)
      }
    } catch (_error) {
      console.error('Error toggling extension:', _error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMemoryInjection = async () => {
    setIsLoading(true)
    try {
      const newState = !memoryInjectionEnabled

      const response = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'SET_MEMORY_INJECTION_ENABLED', enabled: newState }, resolve)
      })

      if (response && response.success) {
        setMemoryInjectionEnabled(newState)
      }
    } catch (_error) {
      console.error('Error toggling memory injection:', _error)
    } finally {
      setIsLoading(false)
    }
  }

  const addBlockedWebsite = async (website: string) => {
    setIsLoading(true)
    try {
      const response = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'ADD_BLOCKED_WEBSITE', website: website }, resolve)
      })
      if (response && response.success) {
        await loadSettings()
      }
    } catch (_error) {
      console.error('Error adding blocked website:', _error)
    } finally {
      setIsLoading(false)
    }
  }

  const removeBlockedWebsite = async (website: string) => {
    setIsLoading(true)
    try {
      const response = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'REMOVE_BLOCKED_WEBSITE', website: website }, resolve)
      })
      if (response && response.success) {
        await loadSettings()
      }
    } catch (_error) {
      console.error('Error removing blocked website:', _error)
    } finally {
      setIsLoading(false)
    }
  }

  const blockCurrentDomain = async () => {
    setIsLoading(true)
    try {
      const activeTabs = await tabs.query({ active: true, currentWindow: true })
      if (activeTabs.length === 0 || !activeTabs[0].url) {
        return
      }

      const url = activeTabs[0].url
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace(/^www\./, '')

        if (domain) {
          await addBlockedWebsite(domain)
        }
      } catch (_error) {
        console.error('Error extracting domain:', _error)
      }
    } catch (_error) {
      console.error('Error getting current tab:', _error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return {
    extensionEnabled,
    memoryInjectionEnabled,
    blockedWebsites,
    isLoading,
    toggleExtension,
    toggleMemoryInjection,
    addBlockedWebsite,
    removeBlockedWebsite,
    blockCurrentDomain,
    reloadSettings: loadSettings,
  }
}
