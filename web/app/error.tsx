"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to whatever logging we wire up in Phase 5.
    console.error("[web]", error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-light">Something went wrong</h1>
        <p className="text-sm text-gray-600 mt-2 mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm border border-gray-300 hover:border-black"
          >
            Try again
          </button>
          <Link href="/" className="px-4 py-2 text-sm bg-black text-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
