import { useState } from "react"
import { identityService } from "@/services/identity.service"
import { toast } from "sonner"

import { cn } from "@/lib/utils.lib"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface MagicLinkFormProps {
  defaultEmail?: string
  onSent?: (email: string) => void
  className?: string
}

export function MagicLinkForm({
  defaultEmail = "",
  onSent,
  className,
}: MagicLinkFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading(true)
    try {
      await identityService.sendMagicLink(email.trim())
      setSent(true)
      onSent?.(email.trim())
      toast.success("Check your email for a sign-in link")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send magic link"
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <div
        className={cn(
          "border border-gray-200 bg-gray-50 p-4 text-center text-sm",
          className
        )}
      >
        <div className="font-medium text-gray-900">Check your email</div>
        <p className="mt-1 text-xs text-gray-600">
          We sent a sign-in link to{" "}
          <span className="font-mono text-gray-900">{email}</span>. The link
          expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 text-xs font-medium text-gray-700 hover:text-gray-900 underline"
        >
          Send another link
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
      <div>
        <label
          htmlFor="magic-link-email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email address
        </label>
        <input
          id="magic-link-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="block w-full px-4 py-3 border border-gray-300 rounded-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400 text-gray-900 text-sm"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !email.trim()}
        className="w-full inline-flex items-center justify-center rounded-none px-4 py-2 transition-all duration-200 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Sending link...
          </>
        ) : (
          "Send sign-in link"
        )}
      </button>
    </form>
  )
}

export default MagicLinkForm
