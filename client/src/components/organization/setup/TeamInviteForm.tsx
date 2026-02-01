import { useState } from "react"
import { Users, Mail, UserPlus, X, Check, AlertCircle } from "lucide-react"
import type { Organization } from "@/types/organization"
import { createInvitations, skipSetupStep } from "@/services/organization/organization.service"

interface TeamInviteFormProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

type RoleType = "ADMIN" | "EDITOR" | "VIEWER"

const ROLES: Array<{ value: RoleType; label: string; description: string }> = [
  { value: "ADMIN", label: "Admin", description: "Full access to all settings" },
  { value: "EDITOR", label: "Editor", description: "Can edit documents and content" },
  { value: "VIEWER", label: "Viewer", description: "Read-only access" },
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
      setError("Please enter a valid email address")
      return
    }

    if (emails.includes(trimmedEmail)) {
      setError("This email has already been added")
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

  const parseEmailInput = (input: string) => {
    // Split by comma, semicolon, or newline and filter valid emails
    const parsed = input
      .split(/[,;\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && validateEmail(e))

    const unique = [...new Set([...emails, ...parsed])]
    setEmails(unique)
    setEmailInput("")
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    parseEmailInput(pastedText)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (emails.length === 0) {
      setError("Please add at least one email address")
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
        // Wait a moment to show success, then complete
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
    } catch (err) {
      console.error("Failed to skip step:", err)
      onComplete() // Complete anyway
    }
  }

  if (results) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          {results.success.length > 0 && (
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Invitations Sent!
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {results.success.length} invitation
                {results.success.length > 1 ? "s" : ""} sent successfully
              </p>
              <ul className="mt-4 space-y-1">
                {results.success.map((email) => (
                  <li key={email} className="text-sm text-gray-600">
                    {email}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.errors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <h4 className="font-medium text-yellow-800 mb-2">
                Some invitations could not be sent:
              </h4>
              <ul className="space-y-1">
                {results.errors.map(({ email, error }) => (
                  <li key={email} className="text-sm text-yellow-700">
                    {email}: {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Input */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Mail className="h-4 w-4" />
          Email Addresses
        </label>
        <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent">
          {/* Email Tags */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 border-b border-gray-200">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
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
              onPaste={handlePaste}
              onBlur={addEmail}
              placeholder={
                emails.length > 0
                  ? "Add more emails..."
                  : "Enter email addresses (comma-separated)"
              }
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={addEmail}
              disabled={!emailInput.trim()}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Press Enter or comma to add. You can paste multiple emails.
        </p>
      </div>

      {/* Role Selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Users className="h-4 w-4" />
          Role for New Members
        </label>
        <div className="space-y-2">
          {ROLES.map((roleOption) => (
            <label
              key={roleOption.value}
              className={`
                flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all
                ${
                  role === roleOption.value
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="role"
                value={roleOption.value}
                checked={role === roleOption.value}
                onChange={(e) => setRole(e.target.value as RoleType)}
                className="h-4 w-4 text-gray-900 focus:ring-gray-900"
              />
              <div className="flex-1">
                <span className="font-medium text-sm text-gray-900">
                  {roleOption.label}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {roleOption.description}
                </span>
              </div>
              {roleOption.value === "EDITOR" && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Recommended
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      {emails.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Ready to invite {emails.length} member{emails.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            They will receive an email invitation to join {organization.name} as{" "}
            {role.toLowerCase()}s.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-sm text-red-600 rounded">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          Skip for now
        </button>
        <div className="flex gap-3">
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
            disabled={isSubmitting || emails.length === 0}
            className="px-6 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send Invitations
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
