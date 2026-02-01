import { useState } from "react"
import type { Organization } from "@/types/organization"
import { createInvitations, skipSetupStep } from "@/services/organization/organization.service"

interface TeamInviteFormProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

type RoleType = "ADMIN" | "EDITOR" | "VIEWER"

const ROLES: Array<{ value: RoleType; label: string; description: string }> = [
  { value: "ADMIN", label: "Admin", description: "Full access" },
  { value: "EDITOR", label: "Editor", description: "Can edit documents" },
  { value: "VIEWER", label: "Viewer", description: "Read-only" },
]

export function TeamInviteForm({
  organization,
  onComplete,
  onCancel,
}: TeamInviteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const [role, setRole] = useState<RoleType>("EDITOR")
  const [results, setResults] = useState<{
    success: string[]
    errors: Array<{ email: string; error: string }>
  } | null>(null)

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const addEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase()
    if (!trimmedEmail) return

    if (!validateEmail(trimmedEmail)) {
      setError("Invalid email address")
      return
    }

    if (emails.includes(trimmedEmail)) {
      setError("Email already added")
      return
    }

    setEmails((prev) => [...prev, trimmedEmail])
    setEmailInput("")
    setError("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addEmail()
    }
  }

  const removeEmail = (emailToRemove: string) => {
    setEmails((prev) => prev.filter((e) => e !== emailToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (emails.length === 0) {
      setError("Add at least one email")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await createInvitations(organization.slug, emails, role)
      setResults({
        success: response.invitations.map((inv) => inv.email),
        errors: response.errors,
      })

      if (response.invitations.length > 0) {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitations")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    try {
      await skipSetupStep(organization.slug, "team")
      onComplete()
    } catch {
      onComplete()
    }
  }

  if (results) {
    return (
      <div className="text-center py-8">
        {results.success.length > 0 && (
          <div className="mb-6">
            <div className="w-12 h-12 bg-gray-900 text-white flex items-center justify-center mx-auto mb-4 text-lg">
              ✓
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Invitations Sent
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              {results.success.length} invitation{results.success.length > 1 ? "s" : ""} sent
            </p>
            <div className="mt-4 space-y-1">
              {results.success.map((email) => (
                <div key={email} className="text-xs font-mono text-gray-600">
                  {email}
                </div>
              ))}
            </div>
          </div>
        )}

        {results.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-left">
            <div className="text-xs font-mono text-red-600 mb-2">Failed:</div>
            {results.errors.map(({ email, error }) => (
              <div key={email} className="text-xs text-red-600">
                {email}: {error}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Input */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
          Email Addresses
        </label>
        <div className="border border-gray-300 focus-within:border-gray-900">
          {/* Email Tags */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-xs font-mono text-gray-700"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center">
            <input
              type="text"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                setError("")
              }}
              onKeyDown={handleKeyDown}
              onBlur={addEmail}
              placeholder={emails.length > 0 ? "Add more..." : "email@example.com"}
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={addEmail}
              disabled={!emailInput.trim()}
              className="px-3 py-2 text-xs font-mono text-gray-500 hover:text-gray-900 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        <p className="text-xs font-mono text-gray-400 mt-1">
          Press Enter or comma to add
        </p>
      </div>

      {/* Role Selection */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
          Role for New Members
        </label>
        <div className="space-y-2">
          {ROLES.map((roleOption) => (
            <label
              key={roleOption.value}
              className={`
                flex items-center gap-3 p-3 border cursor-pointer transition-colors
                ${role === roleOption.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}
              `}
            >
              <input
                type="radio"
                name="role"
                value={roleOption.value}
                checked={role === roleOption.value}
                onChange={(e) => setRole(e.target.value as RoleType)}
                className="sr-only"
              />
              <div
                className={`
                  w-4 h-4 border flex items-center justify-center
                  ${role === roleOption.value ? "border-gray-900 bg-gray-900" : "border-gray-300"}
                `}
              >
                {role === roleOption.value && (
                  <span className="text-white text-xs">✓</span>
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm text-gray-900">{roleOption.label}</span>
                <span className="text-xs text-gray-500 ml-2">{roleOption.description}</span>
              </div>
              {roleOption.value === "EDITOR" && (
                <span className="text-xs font-mono text-gray-400">Recommended</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      {emails.length > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Ready to invite {emails.length} member{emails.length > 1 ? "s" : ""} as {role.toLowerCase()}
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="text-xs font-mono text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          Skip for now
        </button>
        <div className="flex gap-3">
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
            disabled={isSubmitting || emails.length === 0}
            className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Send Invitations"}
          </button>
        </div>
      </div>
    </form>
  )
}
