import { useState } from "react"
import { Shield, Lock, Clock, Globe, Key } from "lucide-react"
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
  { value: "eu", label: "European Union", description: "EU data centers (GDPR compliant)" },
  { value: "asia-pacific", label: "Asia-Pacific", description: "APAC data centers" },
]

const SESSION_TIMEOUT_OPTIONS = [
  { value: "1h", label: "1 hour", description: "High security" },
  { value: "8h", label: "8 hours", description: "Business day" },
  { value: "24h", label: "24 hours", description: "Daily" },
  { value: "7d", label: "7 days", description: "Recommended" },
  { value: "30d", label: "30 days", description: "Convenience" },
]

const PASSWORD_POLICY_OPTIONS = [
  { value: "standard", label: "Standard", description: "8+ characters" },
  { value: "strong", label: "Strong", description: "12+ chars, mixed case, numbers, symbols" },
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
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Globe className="h-4 w-4" />
          Data Residency
        </label>
        <div className="grid grid-cols-2 gap-3">
          {DATA_RESIDENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange("dataResidency", option.value as UpdateSecurityRequest["dataResidency"])}
              className={`
                p-3 border rounded-lg text-left transition-all
                ${
                  formData.dataResidency === option.value
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <div className="font-medium text-sm text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2FA Requirement */}
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Lock className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">
              Require Two-Factor Authentication
            </h4>
            <p className="text-sm text-gray-500 mt-0.5">
              All team members must enable 2FA to access the workspace
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleChange("require2FA", !formData.require2FA)}
          className={`
            relative w-12 h-6 rounded-full transition-colors
            ${formData.require2FA ? "bg-gray-900" : "bg-gray-300"}
          `}
        >
          <span
            className={`
              absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
              ${formData.require2FA ? "translate-x-7" : "translate-x-1"}
            `}
          />
        </button>
      </div>

      {/* Session Timeout */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Clock className="h-4 w-4" />
          Session Timeout
        </label>
        <select
          value={formData.sessionTimeout}
          onChange={(e) => handleChange("sessionTimeout", e.target.value as UpdateSecurityRequest["sessionTimeout"])}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        >
          {SESSION_TIMEOUT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {/* Password Policy */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Key className="h-4 w-4" />
          Password Policy
        </label>
        <div className="space-y-2">
          {PASSWORD_POLICY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`
                flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all
                ${
                  formData.passwordPolicy === option.value
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="passwordPolicy"
                value={option.value}
                checked={formData.passwordPolicy === option.value}
                onChange={(e) => handleChange("passwordPolicy", e.target.value as UpdateSecurityRequest["passwordPolicy"])}
                className="h-4 w-4 text-gray-900 focus:ring-gray-900"
              />
              <div>
                <span className="font-medium text-sm text-gray-900">{option.label}</span>
                <span className="text-sm text-gray-500 ml-2">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Audit Log Retention */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Shield className="h-4 w-4" />
          Audit Log Retention
        </label>
        <select
          value={formData.auditRetention}
          onChange={(e) => handleChange("auditRetention", e.target.value as UpdateSecurityRequest["auditRetention"])}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        >
          {AUDIT_RETENTION_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.enterprise && !isEnterprise}
            >
              {option.label}
              {option.enterprise && !isEnterprise && " (Enterprise only)"}
            </option>
          ))}
        </select>
      </div>

      {/* SSO Section (Enterprise Only) */}
      {isEnterprise && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-gray-600" />
            <h4 className="font-medium text-gray-900">SSO/SAML Configuration</h4>
          </div>
          <p className="text-sm text-gray-600">
            Enterprise SSO configuration is available. Contact support to set up
            Okta, Azure AD, Google Workspace, or custom SAML integration.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-gray-900 underline hover:no-underline"
          >
            Contact Support
          </button>
        </div>
      )}

      {!isEnterprise && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Need SSO/SAML, IP allowlisting, or advanced security features?
            <button
              type="button"
              className="font-medium underline hover:no-underline ml-1"
            >
              Upgrade to Enterprise
            </button>
          </p>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-sm text-red-600 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </form>
  )
}
