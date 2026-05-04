import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cognia",
  alternates: { canonical: "/" },
}

/**
 * Phase 0 placeholder. Phase 1 replaces this with the real landing page
 * ported from client/src/pages/landing.page.tsx.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="text-center">
        <h1 className="text-3xl font-light">Cognia</h1>
        <p className="text-sm font-mono text-gray-500 mt-2">
          web/ — Phase 0 foundation
        </p>
      </div>
    </main>
  )
}
