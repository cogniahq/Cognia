/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { StatusSection } from './components/StatusSection'
import { ExtensionToggle } from './components/ExtensionToggle'
import { MemoryInjectionToggle } from './components/MemoryInjectionToggle'
import { BlockedWebsites } from './components/BlockedWebsites'
import { useExtensionSettings } from './hooks/useExtensionSettings'
import { useStatus } from './hooks/useStatus'

const Popup: React.FC = () => {
  const {
    extensionEnabled,
    memoryInjectionEnabled,
    blockedWebsites,
    isLoading,
    toggleExtension,
    toggleMemoryInjection,
    addBlockedWebsite,
    removeBlockedWebsite,
    blockCurrentDomain,
  } = useExtensionSettings()

  const { isConnected, isAuthenticated, isCheckingHealth, lastCaptureTime } = useStatus()

  return (
    <div
      className="w-80 bg-white text-black font-primary"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-base font-mono">
            C
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-black">Cognia</span>
            <span className="text-xs text-gray-600 font-mono -mt-0.5">
              Remember what the web showed you
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <StatusSection
          isConnected={isConnected}
          isAuthenticated={isAuthenticated}
          isCheckingHealth={isCheckingHealth}
          lastCaptureTime={lastCaptureTime}
        />

        <ExtensionToggle
          extensionEnabled={extensionEnabled}
          isLoading={isLoading}
          onToggle={toggleExtension}
        />

        <MemoryInjectionToggle
          memoryInjectionEnabled={memoryInjectionEnabled}
          isLoading={isLoading}
          onToggle={toggleMemoryInjection}
        />

        <BlockedWebsites
          blockedWebsites={blockedWebsites}
          isLoading={isLoading}
          onAdd={addBlockedWebsite}
          onRemove={removeBlockedWebsite}
          onBlockCurrentDomain={blockCurrentDomain}
        />
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
