import { useMemo, useState } from "react"
import { identityService } from "@/services/identity.service"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils.lib"

type Provider = "SAML" | "OIDC"
type OrgRole = "ADMIN" | "EDITOR" | "VIEWER"

interface RoleMapping {
  group: string
  role: OrgRole
}

export interface SsoSetupValues {
  provider: Provider | null
  // SAML
  samlEntityId: string
  samlSsoUrl: string
  samlCertificate: string
  // OIDC
  oidcIssuer: string
  oidcClientId: string
  oidcClientSecret: string
  // Attribute mapping
  attrEmail: string
  attrGroups: string
  // Role mappings
  roleMappings: RoleMapping[]
  // Domains + enforcement
  ssoEmailDomains: string[]
  ssoEnforced: boolean
}

export interface SsoSetupWizardProps {
  slug: string
  initial?: Partial<SsoSetupValues>
  onSaved?: (values: SsoSetupValues) => void
}

const STEPS = [
  { id: 1, label: "Provider" },
  { id: 2, label: "IdP details" },
  { id: 3, label: "Attributes" },
  { id: 4, label: "Roles" },
  { id: 5, label: "Domains" },
] as const

const DEFAULT_VALUES: SsoSetupValues = {
  provider: null,
  samlEntityId: "",
  samlSsoUrl: "",
  samlCertificate: "",
  oidcIssuer: "",
  oidcClientId: "",
  oidcClientSecret: "",
  attrEmail: "email",
  attrGroups: "groups",
  roleMappings: [],
  ssoEmailDomains: [],
  ssoEnforced: false,
}

function StepHeader({
  step,
  total,
  label,
}: {
  step: number
  total: number
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
        Step {step} / {total}
      </div>
      <div className="text-sm font-medium text-gray-900">{label}</div>
    </div>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-1.5"
    >
      {children}
    </label>
  )
}

const inputClass =
  "block w-full px-3 py-2 border border-gray-300 rounded-none text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400"

export function SsoSetupWizard({
  slug,
  initial,
  onSaved,
}: SsoSetupWizardProps) {
  const [values, setValues] = useState<SsoSetupValues>(() => ({
    ...DEFAULT_VALUES,
    ...(initial ?? {}),
    roleMappings:
      initial?.roleMappings && initial.roleMappings.length > 0
        ? initial.roleMappings
        : DEFAULT_VALUES.roleMappings,
    ssoEmailDomains: initial?.ssoEmailDomains ?? [],
  }))
  const [step, setStep] = useState(1)
  const [domainInput, setDomainInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const update = <K extends keyof SsoSetupValues>(
    key: K,
    value: SsoSetupValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }))

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return !!values.provider
      case 2:
        if (values.provider === "SAML") {
          return !!(
            values.samlEntityId.trim() &&
            values.samlSsoUrl.trim() &&
            values.samlCertificate.trim()
          )
        }
        if (values.provider === "OIDC") {
          return !!(
            values.oidcIssuer.trim() &&
            values.oidcClientId.trim() &&
            values.oidcClientSecret.trim()
          )
        }
        return false
      case 3:
        return !!(values.attrEmail.trim() && values.attrGroups.trim())
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }, [step, values])

  const addRoleMapping = () =>
    update("roleMappings", [
      ...values.roleMappings,
      { group: "", role: "VIEWER" },
    ])
  const updateRoleMapping = (idx: number, patch: Partial<RoleMapping>) => {
    const next = values.roleMappings.slice()
    next[idx] = { ...next[idx], ...patch }
    update("roleMappings", next)
  }
  const removeRoleMapping = (idx: number) => {
    const next = values.roleMappings.slice()
    next.splice(idx, 1)
    update("roleMappings", next)
  }

  const addDomain = () => {
    const domain = domainInput.trim().toLowerCase()
    if (!domain) return
    if (values.ssoEmailDomains.includes(domain)) {
      setDomainInput("")
      return
    }
    update("ssoEmailDomains", [...values.ssoEmailDomains, domain])
    setDomainInput("")
  }

  const removeDomain = (domain: string) =>
    update(
      "ssoEmailDomains",
      values.ssoEmailDomains.filter((d) => d !== domain)
    )

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      sso_provider: values.provider,
      sso_email_domains: values.ssoEmailDomains,
      sso_enforced: values.ssoEnforced,
      sso_attribute_mapping: {
        email: values.attrEmail,
        groups: values.attrGroups,
      },
      sso_role_mappings: values.roleMappings.filter((m) => m.group.trim()),
    }
    if (values.provider === "SAML") {
      base.sso_saml_entity_id = values.samlEntityId
      base.sso_saml_sso_url = values.samlSsoUrl
      base.sso_saml_certificate = values.samlCertificate
    } else if (values.provider === "OIDC") {
      base.sso_oidc_issuer = values.oidcIssuer
      base.sso_oidc_client_id = values.oidcClientId
      base.sso_oidc_client_secret = values.oidcClientSecret
    }
    return base
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await identityService.updateSso(slug, buildPayload())
      toast.success("SSO configuration saved")
      onSaved?.(values)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save SSO"
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <StepHeader
        step={step}
        total={STEPS.length}
        label={STEPS[step - 1].label}
      />

      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              "flex-1 h-1.5 rounded-full transition-colors",
              s.id <= step ? "bg-gray-900" : "bg-gray-200"
            )}
          />
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Choose the protocol your identity provider uses.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["SAML", "OIDC"] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update("provider", p)}
                className={cn(
                  "border p-4 text-left transition-colors",
                  values.provider === p
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-400"
                )}
              >
                <div className="text-sm font-medium text-gray-900">{p}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {p === "SAML"
                    ? "SAML 2.0 — Okta, Azure AD, OneLogin, ADFS, Ping."
                    : "OpenID Connect — Auth0, Google Workspace, Keycloak."}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          {values.provider === "SAML" ? (
            <>
              <div>
                <FieldLabel htmlFor="saml-entity-id">IdP Entity ID</FieldLabel>
                <input
                  id="saml-entity-id"
                  type="text"
                  value={values.samlEntityId}
                  onChange={(e) => update("samlEntityId", e.target.value)}
                  placeholder="https://idp.example.com/metadata"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="saml-sso-url">SSO URL</FieldLabel>
                <input
                  id="saml-sso-url"
                  type="url"
                  value={values.samlSsoUrl}
                  onChange={(e) => update("samlSsoUrl", e.target.value)}
                  placeholder="https://idp.example.com/sso"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="saml-cert">
                  X.509 signing certificate
                </FieldLabel>
                <textarea
                  id="saml-cert"
                  value={values.samlCertificate}
                  onChange={(e) => update("samlCertificate", e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----..."
                  rows={6}
                  className={cn(inputClass, "font-mono text-xs")}
                />
              </div>
              <div className="text-xs text-gray-500 border border-gray-200 bg-gray-50 p-3">
                SP metadata for your IdP:{" "}
                <a
                  href={identityService.samlMetadataUrl(slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-gray-900 underline"
                >
                  Download metadata XML
                </a>
              </div>
            </>
          ) : values.provider === "OIDC" ? (
            <>
              <div>
                <FieldLabel htmlFor="oidc-issuer">Issuer URL</FieldLabel>
                <input
                  id="oidc-issuer"
                  type="url"
                  value={values.oidcIssuer}
                  onChange={(e) => update("oidcIssuer", e.target.value)}
                  placeholder="https://accounts.example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="oidc-client-id">Client ID</FieldLabel>
                <input
                  id="oidc-client-id"
                  type="text"
                  value={values.oidcClientId}
                  onChange={(e) => update("oidcClientId", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="oidc-client-secret">
                  Client secret
                </FieldLabel>
                <input
                  id="oidc-client-secret"
                  type="password"
                  value={values.oidcClientSecret}
                  onChange={(e) => update("oidcClientSecret", e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Map IdP attributes to Cognia user fields.
          </p>
          <div>
            <FieldLabel htmlFor="attr-email">Email attribute</FieldLabel>
            <input
              id="attr-email"
              type="text"
              value={values.attrEmail}
              onChange={(e) => update("attrEmail", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="attr-groups">Groups attribute</FieldLabel>
            <input
              id="attr-groups"
              type="text"
              value={values.attrGroups}
              onChange={(e) => update("attrGroups", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Map IdP groups to Cognia roles. Users in matching groups receive the
            mapped role on JIT provisioning.
          </p>
          <div className="border border-gray-200">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-mono uppercase tracking-wide text-gray-500">
              <div className="col-span-7">IdP group</div>
              <div className="col-span-4">Org role</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-gray-100">
              {values.roleMappings.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">
                  No mappings yet. Click "Add mapping" below.
                </div>
              )}
              {values.roleMappings.map((m, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center px-3 py-2"
                >
                  <input
                    type="text"
                    value={m.group}
                    onChange={(e) =>
                      updateRoleMapping(idx, { group: e.target.value })
                    }
                    placeholder="cognia-admins"
                    className={cn(inputClass, "col-span-7 py-1.5 text-xs")}
                  />
                  <select
                    value={m.role}
                    onChange={(e) =>
                      updateRoleMapping(idx, {
                        role: e.target.value as OrgRole,
                      })
                    }
                    className={cn(inputClass, "col-span-4 py-1.5 text-xs")}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRoleMapping(idx)}
                    className="col-span-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove mapping ${idx + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={addRoleMapping}
            className="text-xs font-medium px-3 py-1.5 border border-gray-300 hover:bg-gray-50"
          >
            + Add mapping
          </button>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Email domains that route to this SSO. Users with matching domains
            see your branded sign-in flow.
          </p>
          <div>
            <FieldLabel htmlFor="domain-input">Email domains</FieldLabel>
            <div className="flex gap-2">
              <input
                id="domain-input"
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addDomain()
                  }
                }}
                placeholder="example.com"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addDomain}
                className="text-xs font-medium px-3 py-1.5 border border-gray-300 hover:bg-gray-50"
              >
                Add
              </button>
            </div>
            {values.ssoEmailDomains.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {values.ssoEmailDomains.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-2 px-2.5 py-1 border border-gray-300 bg-gray-50 text-xs font-mono text-gray-700"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => removeDomain(d)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label={`Remove ${d}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-start gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.ssoEnforced}
              onChange={(e) => update("ssoEnforced", e.target.checked)}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Enforce SSO
              </div>
              <div className="text-xs text-gray-600">
                When enforced, users with matching email domains can only sign
                in via SSO. Password and OAuth fallback are disabled.
              </div>
            </div>
          </label>
        </div>
      )}

      {saveError && (
        <div className="px-3 py-2 border border-red-200 bg-red-50 text-xs text-red-700">
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || isSaving}
          className="text-xs font-medium px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {step < STEPS.length ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
            disabled={!canAdvance}
            className="text-xs font-medium px-4 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs font-medium px-4 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
            {isSaving ? "Saving..." : "Save SSO config"}
          </button>
        )}
      </div>
    </div>
  )
}

export default SsoSetupWizard
