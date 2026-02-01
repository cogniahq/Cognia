import { useState } from "react"
import type { Organization } from "@/types/organization"
import { updateSecurity, type UpdateSecurityRequest } from "@/services/organization/organization.service"

interface SecurityComplianceFormProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

const DATA_RESIDENCY_OPTIONS = [
  { value: "auto", label: "Auto-detect", description: "Based on user location" },
  { value: "us", label: "United States", description: "US data centers" },
  { value: "eu", label: "European Union", description: "GDPR compliant" },
  { value: "asia-pacific", label: "Asia-Pacific", description: "APAC region" },
]

const SESSION_TIMEOUT_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "8h", label: "8 hours" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
]

const PASSWORD_POLICY_OPTIONS = [
  { value: "standard", label: "Standard", description: "8+ characters" },
  { value: "strong", label: "Strong", description: "12+ chars, mixed" },
]

const AUDIT_RETENTION_OPTIONS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "1 year" },
  { value: "unlimited", label: "Unlimited", enterprise: true },
]

export function SecurityComplianceForm({
  organization,
  onComplete,
  onCancel,
}: SecurityComplianceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState<UpdateSecurityRequest>({
    dataResidency: (organization.data_residency as UpdateSecurityRequest["dataResidency"]) || "auto",
    require2FA: organization.require_2fa || false,
    sessionTimeout: (organization.session_timeout as UpdateSecurityRequest["sessionTimeout"]) || "7d",
    passwordPolicy: (organization.password_policy as UpdateSecurityRequest["passwordPolicy"]) || "standard",
    auditRetention: (organization.audit_retention as UpdateSecurityRequest["auditRetention"]) || "90d",
  })

  const handleChange = <K extends keyof UpdateSecurityRequest>(
    field: K,
    value: UpdateSecurityRequest[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      await updateSecurity(organization.slug, formData)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update security settings")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEnterprise = organization.plan === "enterprise"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Data Residency */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
          Data Residency
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DATA_RESIDENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange("dataResidency", option.value as UpdateSecurityRequest["dataResidency"])}
              className={`
                p-3 border text-left transition-colors
                ${formData.dataResidency === option.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}
              `}
            >
              <div className="text-sm text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2FA Requirement */}
      <div className="flex items-center justify-between p-4 border border-gray-200">
        <div>
          <h4 className="text-sm text-gray-900">Require Two-Factor Authentication</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            All members must enable 2FA
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleChange("require2FA", !formData.require2FA)}
          className={`
            w-10 h-5 flex items-center transition-colors
            ${formData.require2FA ? "bg-gray-900" : "bg-gray-300"}
          `}
        >
          <span
            className={`
              w-4 h-4 bg-white transition-transform
              ${formData.require2FA ? "translate-x-5" : "translate-x-0.5"}
            `}
          />
        </button>
      </div>

      {/* Session Timeout */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
          Session Timeout
        </label>
        <select
          value={formData.sessionTimeout}
          onChange={(e) => handleChange("sessionTimeout", e.target.value as UpdateSecurityRequest["sessionTimeout"])}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 bg-white"
        >
          {SESSION_TIMEOUT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Password Policy */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
          Password Policy
        </label>
        <div className="space-y-2">
          {PASSWORD_POLICY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`
                flex items-center gap-3 p-3 border cursor-pointer transition-colors
                ${formData.passwordPolicy === option.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}
              `}
            >
              <input
                type="radio"
                name="passwordPolicy"
                value={option.value}
                checked={formData.passwordPolicy === option.value}
                onChange={(e) => handleChange("passwordPolicy", e.target.value as UpdateSecurityRequest["passwordPolicy"])}
                className="sr-only"
              />
              <div
                className={`
                  w-4 h-4 border flex items-center justify-center
                  ${formData.passwordPolicy === option.value ? "border-gray-900 bg-gray-900" : "border-gray-300"}
                `}
              >
                {formData.passwordPolicy === option.value && (
                  <span className="text-white text-xs">✓</span>
                )}
              </div>
              <div>
                <span className="text-sm text-gray-900">{option.label}</span>
                <span className="text-xs text-gray-500 ml-2">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Audit Log Retention */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
          Audit Log Retention
        </label>
        <select
          value={formData.auditRetention}
          onChange={(e) => handleChange("auditRetention", e.target.value as UpdateSecurityRequest["auditRetention"])}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 bg-white"
        >
          {AUDIT_RETENTION_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.enterprise && !isEnterprise}
            >
              {option.label}
              {option.enterprise && !isEnterprise && " (Enterprise)"}
            </option>
          ))}
        </select>
      </div>

      {!isEnterprise && (
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-600">
          Need SSO, IP allowlisting, or advanced security? Upgrade to Enterprise.
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </form>
  )
}
