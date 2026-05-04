"use client"

import { useEffect } from "react"

import { useSession } from "@/lib/auth/client"
import { syncSessionToExtension } from "@/lib/auth/extension-bridge"

/**
 * Headless client island mounted under (app)/layout.tsx. Whenever the
 * server-hydrated session changes user id, post a message to the Cognia
 * browser extension so it can refresh its destinations cache. No-op when
 * the extension isn't installed.
 *
 * Lives under (app)/ so it only fires for authenticated users — there's
 * no point bridging an anonymous session to the extension.
 */
export function ExtensionAuthBridge() {
  const session = useSession()
  const userId = session.user.id

  useEffect(() => {
    if (!userId) return
    syncSessionToExtension(userId)
  }, [userId])

  return null
}
