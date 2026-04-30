import { useEffect, useRef, useState } from "react"
import {
  identityService,
  type SsoDiscoveryResult,
} from "@/services/identity.service"

import { cn } from "@/lib/utils.lib"

interface SsoDiscoveryProps {
  email: string
  onResult?: (result: SsoDiscoveryResult | null) => void
  /** Children render-prop receiving the discovery state. */
  children?: (state: {
    result: SsoDiscoveryResult | null
    isChecking: boolean
    error: string | null
  }) => React.ReactNode
  className?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * SsoDiscovery — debounced lookup against /api/sso/discover. Pure data
 * component: it doesn't render the SSO branch UI on its own. Callers can
 * either consume the result via `onResult` (e.g. login page wiring) or via
 * the render-prop `children`.
 */
export function SsoDiscovery({
  email,
  onResult,
  children,
  className,
}: SsoDiscoveryProps) {
  const [result, setResult] = useState<SsoDiscoveryResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastEmailRef = useRef<string>("")

  useEffect(() => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setResult(null)
      onResult?.(null)
      lastEmailRef.current = ""
      return
    }
    if (trimmed === lastEmailRef.current) return

    let cancelled = false
    const handle = window.setTimeout(async () => {
      setIsChecking(true)
      setError(null)
      try {
        const r = await identityService.discoverSso(trimmed)
        if (cancelled) return
        lastEmailRef.current = trimmed
        setResult(r)
        onResult?.(r)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "SSO discovery failed")
        setResult(null)
        onResult?.(null)
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [email, onResult])

  if (children) {
    return (
      <div className={className}>{children({ result, isChecking, error })}</div>
    )
  }

  if (!result?.ssoAvailable && !isChecking) return null

  return (
    <div
      className={cn(
        "text-xs font-mono text-gray-500 px-3 py-2 border border-gray-200 bg-gray-50",
        className
      )}
    >
      {isChecking
        ? "Checking SSO..."
        : result?.enforced
          ? `SSO required for ${result.orgName ?? "this org"}`
          : `SSO available for ${result?.orgName ?? "this org"}`}
    </div>
  )
}

export default SsoDiscovery
