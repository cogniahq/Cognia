import { useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { identityService } from "@/services/identity.service"
import { toast } from "sonner"

interface EmailVerificationBannerProps {
  /** Allow callers to suppress the banner on specific pages. */
  hidden?: boolean
}

interface UserWithVerification {
  email?: string
  email_verified_at?: string | null
}

export function EmailVerificationBanner({
  hidden,
}: EmailVerificationBannerProps) {
  const { user, isAuthenticated } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const u = user as (UserWithVerification & { id?: string }) | null
  const verified = u?.email_verified_at != null
  if (hidden || dismissed || !isAuthenticated || !u || verified) return null

  const handleResend = async () => {
    setIsSending(true)
    try {
      await identityService.resendVerification()
      setSent(true)
      toast.success("Verification email sent — check your inbox")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to resend verification"
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <svg
              className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-sm text-amber-900 min-w-0">
              <span className="font-medium">Verify your email.</span>{" "}
              <span className="text-amber-800">
                We sent a verification link to{" "}
                <span className="font-mono">{u.email}</span>. Some workspace
                features stay locked until you confirm.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending || sent}
              className="text-xs font-medium px-3 py-1.5 border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? "Sending..." : sent ? "Sent" : "Resend email"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-amber-700 hover:text-amber-900 px-2 py-1.5"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationBanner
