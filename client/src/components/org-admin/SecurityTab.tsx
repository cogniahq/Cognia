import { useCallback, useEffect, useState } from "react"
import {
  orgAdminService,
  type SecurityStatus,
} from "@/services/org-admin.service"
import { Loader2 } from "lucide-react"

interface SecurityTabProps {
  slug: string
}

function StatusBadge({
  ok,
  okLabel = "Enabled",
  offLabel = "Disabled",
}: {
  ok: boolean
  okLabel?: string
  offLabel?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono ${
        ok
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      {ok ? okLabel : offLabel}
    </span>
  )
}

function MetricCard({
  label,
  value,
  hint,
  children,
}: {
  label: string
  value?: React.ReactNode
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
        {label}
      </div>
      {value !== undefined && (
        <div className="mt-2 text-2xl font-light font-editorial text-gray-900">
          {value}
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
      {children}
    </div>
  )
}

export default function SecurityTab({ slug }: SecurityTabProps) {
  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await orgAdminService.getSecurityStatus(slug)
      setStatus(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load security status"
      )
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">
          Loading security status...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
        {error}
      </div>
    )
  }

  if (!status) return null

  const twoFa = status.twoFaEnrollment
  const twoFaPct = twoFa.total > 0 ? twoFa.percentage : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 2FA Enrollment */}
        <MetricCard label="2FA enrollment">
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl font-light font-editorial text-gray-900">
              {twoFaPct}%
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {twoFa.enabled}/{twoFa.total}
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${twoFaPct >= 80 ? "bg-green-500" : twoFaPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, twoFaPct)}%` }}
            />
          </div>
          <div className="mt-3">
            <StatusBadge
              ok={twoFa.required}
              okLabel="Required"
              offLabel="Optional"
            />
          </div>
        </MetricCard>

        {/* SSO */}
        <MetricCard label="Single sign-on">
          <div className="mt-3">
            <StatusBadge ok={status.sso.enabled} />
          </div>
          {status.sso.provider && (
            <div className="mt-2 text-xs font-mono text-gray-500">
              Provider: {status.sso.provider}
            </div>
          )}
        </MetricCard>

        {/* IP allowlist */}
        <MetricCard
          label="IP allowlist"
          value={status.ipAllowlist.size}
          hint={
            status.ipAllowlist.enabled
              ? "Active CIDR rules"
              : "No restrictions in effect"
          }
        >
          <div className="mt-3">
            <StatusBadge
              ok={status.ipAllowlist.enabled}
              okLabel="Enforced"
              offLabel="Off"
            />
          </div>
        </MetricCard>

        {/* Session timeout */}
        <MetricCard
          label="Session timeout"
          value={
            status.session.timeout ? `${status.session.timeout} min` : "Default"
          }
          hint="Idle sessions auto-logout after this window"
        />

        {/* Audit retention */}
        <MetricCard
          label="Audit retention"
          value={
            status.audit.retention
              ? `${status.audit.retention} days`
              : "Default"
          }
          hint="How long activity events are retained"
        />

        {/* Data residency */}
        <MetricCard
          label="Data residency"
          value={status.dataResidency || "—"}
          hint="Region where org data lives"
        />
      </div>

      {/* Password policy */}
      {status.passwordPolicy &&
        Object.keys(status.passwordPolicy).length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
              Password policy
            </div>
            <div className="divide-y divide-gray-100">
              {Object.entries(status.passwordPolicy).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-3 gap-4 px-5 py-3 text-sm"
                >
                  <div className="text-gray-500 font-mono text-xs uppercase tracking-wide">
                    {k}
                  </div>
                  <div className="col-span-2 text-gray-900 font-mono text-xs">
                    {typeof v === "boolean"
                      ? v
                        ? "yes"
                        : "no"
                      : v === null || v === undefined
                        ? "—"
                        : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
