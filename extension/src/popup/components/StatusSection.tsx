import React from 'react'
import { cn } from '@/lib/utils'

interface StatusSectionProps {
  isConnected: boolean
  isAuthenticated: boolean
  isCheckingHealth: boolean
  lastCaptureTime: number | null
  dlpBlockCount?: number
}

type Tone = 'success' | 'warning' | 'destructive' | 'muted'

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const toneClasses: Record<Tone, { dot: string; ring: string; text: string }> = {
  success: {
    dot: 'bg-success',
    ring: 'bg-success/40',
    text: 'text-foreground',
  },
  warning: {
    dot: 'bg-warning',
    ring: 'bg-warning/40',
    text: 'text-foreground',
  },
  destructive: {
    dot: 'bg-destructive',
    ring: 'bg-destructive/40',
    text: 'text-foreground',
  },
  muted: {
    dot: 'bg-muted-foreground',
    ring: 'bg-muted-foreground/30',
    text: 'text-muted-foreground',
  },
}

const StatusDot: React.FC<{ tone: Tone; pulse?: boolean }> = ({ tone, pulse }) => {
  const cls = toneClasses[tone]
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && (
        <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', cls.ring)} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', cls.dot)} />
    </span>
  )
}

export const StatusSection: React.FC<StatusSectionProps> = ({
  isConnected,
  isAuthenticated,
  isCheckingHealth,
  lastCaptureTime,
  dlpBlockCount = 0,
}) => {
  let primaryLabel: string
  let primaryTone: Tone
  let pulse = false

  if (isCheckingHealth) {
    primaryLabel = 'Checking connection'
    primaryTone = 'muted'
  } else if (!isConnected) {
    primaryLabel = 'Offline'
    primaryTone = 'destructive'
  } else if (!isAuthenticated) {
    primaryLabel = 'Signed out'
    primaryTone = 'warning'
  } else {
    primaryLabel = 'Online'
    primaryTone = 'success'
    pulse = true
  }

  const apiTone: Tone = isCheckingHealth ? 'muted' : isConnected ? 'success' : 'destructive'
  const authTone: Tone = isAuthenticated ? 'success' : 'warning'

  return (
    <div className="rounded-md border border-border bg-surface-subtle px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot tone={primaryTone} pulse={pulse} />
          <span className="text-[13px] font-medium tracking-tight text-foreground truncate">
            {primaryLabel}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          {lastCaptureTime ? formatTimeAgo(lastCaptureTime) : '— no captures'}
        </span>
      </div>

      <div className="flex items-center gap-3 pl-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses[apiTone].dot)} />
          API
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses[authTone].dot)} />
          Auth
        </span>
        {dlpBlockCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span
              className="inline-flex items-center gap-1.5"
              title="Captures dropped by client-side DLP because they matched a secret-like pattern"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses.warning.dot)} />
              DLP {dlpBlockCount}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
