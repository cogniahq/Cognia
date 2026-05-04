"use client"

/**
 * Firebase availability shim.
 *
 * The Vite client uses Firebase only for Firestore (client/src/lib/firebase.ts).
 * The production sign-in OAuth flow does NOT use Firebase — the API exposes
 * redirect-based OAuth at /api/auth/oauth/:provider/start, and OAuthButton
 * dispatches the user there directly. To avoid pulling the ~120 kB Firebase
 * SDK into the Next bundle for a feature we no longer use on this surface,
 * we ship a minimal `isFirebaseConfigured()` check based on env vars.
 *
 * If a future surface needs Firestore (or Firebase auth), add `firebase` to
 * package.json and replace `getFirebase()` below with a real `initializeApp()`
 * call. The signature is intentionally kept compatible with that future
 * implementation so call sites won't have to change.
 */
import { env } from "./env"

export function isFirebaseConfigured(): boolean {
  return Boolean(
    env.firebase.apiKey &&
    env.firebase.authDomain &&
    env.firebase.projectId &&
    env.firebase.appId
  )
}

/**
 * Returns null in this build — the firebase npm package is not currently a
 * dependency of `web/`. See file header for migration path.
 */
export async function getFirebase(): Promise<null> {
  return null
}
