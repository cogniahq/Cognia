import type { Metadata } from "next"

import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager"

export const metadata: Metadata = {
  title: "API keys",
  robots: { index: false, follow: false },
}

/**
 * Personal-account API keys. The ApiKeyManager component handles the
 * full CRUD lifecycle (create with one-time-plaintext modal, revoke,
 * scope edit) — wrapping it here is just the page chrome.
 */
export default function ApiKeysPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
            Settings
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Developer
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
            API keys
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Workspace-scoped credentials for the public Cognia API.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
          <ApiKeyManager />
        </div>
      </div>
    </div>
  )
}
