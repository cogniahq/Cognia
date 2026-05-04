"use client"

import { createContext, useContext } from "react"
import type { Session } from "./session"

/**
 * Client-side session access. The (app) layout's Server Component fetches
 * the session and hydrates this provider; client islands read it via
 * useSession(). This replaces client/src/contexts/auth.context.tsx + the
 * useEffect-loop fetch pattern.
 */
const SessionContext = createContext<Session | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession() called outside SessionProvider — make sure the route is under (app)/")
  }
  return ctx
}

export function useOptionalSession(): Session | null {
  return useContext(SessionContext)
}
