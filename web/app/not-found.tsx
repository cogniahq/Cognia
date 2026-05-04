import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-light">Page not found</h1>
        <p className="text-sm text-gray-600 mt-2 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/" className="text-sm underline">
          Return home
        </Link>
      </div>
    </main>
  )
}
