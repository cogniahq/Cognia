import { useCallback, useEffect, useState } from "react"
import { identityService } from "@/services/identity.service"
import { orgAdminService } from "@/services/org-admin.service"
import { Loader2 } from "lucide-react"

import ScimTokensManager from "@/components/org-admin/ScimTokensManager"
import SsoSetupWizard from "@/components/org-admin/SsoSetupWizard"

interface SsoSetupTabProps {
  slug: string
}

export default function SsoSetupTab({ slug }: SsoSetupTabProps) {
  const [hasConfig, setHasConfig] = useState<boolean | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await orgAdminService.getSecurityStatus(slug)
      setHasConfig(!!data.sso?.enabled)
      setProvider(data.sso?.provider ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SSO status")
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading && hasConfig === null) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Loading SSO status...</span>
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

  return (
    <div className="space-y-8">
      {/* Status panel */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
              Single sign-on
            </div>
            <div className="mt-2 text-2xl font-light font-editorial text-gray-900">
              {hasConfig ? `${provider ?? "Configured"}` : "Not configured"}
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {hasConfig
                ? "Members in your enforced email domains sign in through your IdP. JIT provisioning is on."
                : "Connect your identity provider to enforce centralized authentication."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasConfig && (
              <a
                href={identityService.samlMetadataUrl(slug)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50"
              >
                Download SP metadata
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowWizard((s) => !s)}
              className="text-xs font-medium px-3 py-2 bg-gray-900 text-white hover:bg-black"
            >
              {showWizard
                ? "Hide wizard"
                : hasConfig
                  ? "Reconfigure"
                  : "Set up SSO"}
            </button>
          </div>
        </div>
      </div>

      {/* Wizard */}
      {showWizard && (
        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            SSO setup wizard
          </h3>
          <p className="text-xs text-gray-500 mb-5">
            Five steps. Save anytime — partial configs stay disabled until all
            required fields are present.
          </p>
          <SsoSetupWizard
            slug={slug}
            onSaved={() => {
              setShowWizard(false)
              load()
            }}
          />
        </div>
      )}

      {/* SCIM */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          SCIM provisioning tokens
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Generate bearer tokens for your IdP's SCIM client. Tokens are shown
          once on creation — store them securely.
        </p>
        <ScimTokensManager slug={slug} />
      </div>
    </div>
  )
}
