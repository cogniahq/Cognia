import Image from "next/image"
import Link from "next/link"

interface AuthErrorViewProps {
  title: string
  message: string
  /** Optional override for the CTA. Defaults to "Back to sign in" → /login. */
  cta?: { href: string; label: string }
}

/**
 * Shared error/empty state for the verify-email + magic-link surfaces.
 * Pure Server Component — no client JS shipped for static error pages.
 */
export function AuthErrorView({ title, message, cta }: AuthErrorViewProps) {
  const ctaHref = cta?.href ?? "/login"
  const ctaLabel = cta?.label ?? "Back to sign in"
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-md w-full bg-white border border-gray-200 p-8 shadow-sm">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <Image
              src="/black-transparent.png"
              alt="Cognia"
              width={48}
              height={48}
              className="w-12 h-12"
            />
          </div>
          <h1 className="text-2xl font-light font-editorial text-gray-900">
            {title}
          </h1>
          <p className="text-sm text-red-700">{message}</p>
          <Link
            href={ctaHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-none px-4 py-2 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black text-sm font-medium transition-colors"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

interface AuthSuccessViewProps {
  title: string
  message: string
  cta: { href: string; label: string }
}

export function AuthSuccessView({ title, message, cta }: AuthSuccessViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-md w-full bg-white border border-gray-200 p-8 shadow-sm">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <Image
              src="/black-transparent.png"
              alt="Cognia"
              width={48}
              height={48}
              className="w-12 h-12"
            />
          </div>
          <h1 className="text-2xl font-light font-editorial text-gray-900">
            {title}
          </h1>
          <p className="text-sm text-gray-600">{message}</p>
          <Link
            href={cta.href}
            className="mt-4 inline-flex w-full items-center justify-center rounded-none px-4 py-2 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black text-sm font-medium transition-colors"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  )
}
