/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { StatusSection } from './components/StatusSection'
import { ExtensionToggle } from './components/ExtensionToggle'
import { MemoryInjectionToggle } from './components/MemoryInjectionToggle'
import { BlockedWebsites } from './components/BlockedWebsites'
import { DestinationPicker } from './components/DestinationPicker'
import { ExternalLinkIcon } from './components/Icons'
import { useExtensionSettings } from './hooks/useExtensionSettings'
import { useStatus } from './hooks/useStatus'

const DASHBOARD_URL = 'https://cogniahq.tech'

const Header: React.FC = () => {
  const openDashboard = () => {
    window.open(DASHBOARD_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <span className="font-mono text-[15px] font-semibold leading-none">C</span>
          <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full border-2 border-background bg-success" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-editorial text-[18px] leading-none text-foreground">Cognia</span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            Memory · v0.1
          </span>
        </div>
      </div>
      <button
        onClick={openDashboard}
        aria-label="Open Cognia dashboard"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExternalLinkIcon size={14} />
      </button>
    </header>
  )
}

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

  const { isConnected, isAuthenticated, isCheckingHealth, lastCaptureTime, dlpBlockCount } =
    useStatus()

  return (
    <div className="w-[360px] bg-background text-foreground font-primary">
      <Header />

      <div className="border-t border-border" />

      <main className="px-4 pt-3.5 pb-4 space-y-3.5">
        <StatusSection
          isConnected={isConnected}
          isAuthenticated={isAuthenticated}
          isCheckingHealth={isCheckingHealth}
          lastCaptureTime={lastCaptureTime}
          dlpBlockCount={dlpBlockCount}
        />

        <DestinationPicker />

        <section className="rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Controls
            </h3>
          </header>
          <div className="divide-y divide-border">
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
          </div>
        </section>

        <BlockedWebsites
          blockedWebsites={blockedWebsites}
          isLoading={isLoading}
          onAdd={addBlockedWebsite}
          onRemove={removeBlockedWebsite}
          onBlockCurrentDomain={blockCurrentDomain}
        />
      </main>

      <footer className="border-t border-border px-4 py-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Local-first · Encrypted
        </span>
        <button
          onClick={() => window.open(DASHBOARD_URL, '_blank', 'noopener,noreferrer')}
          className="font-mono text-[10px] uppercase tracking-wider text-foreground hover:underline"
        >
          Dashboard ↗
        </button>
      </footer>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
