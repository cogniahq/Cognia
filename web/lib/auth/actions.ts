"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { env } from "../env"
import { clearSessionCookie, forwardSessionCookie } from "./cookie"

/**
 * Server Actions for the auth + onboarding flows. Each action posts to the
 * upstream API at NEXT_PUBLIC_API_URL and forwards the Set-Cookie response
 * onto the user's browser via Next's cookie store, then either redirects on
 * success or returns a serialisable error shape so the calling form can
 * render it via useFormState/useActionState.
 *
 * NOTE: redirect() throws a special NEXT_REDIRECT error that React swallows;
 * never wrap action bodies in try/catch unless you re-throw the redirect.
 */

const POST_LOGIN_PATH = "/organization"
const ONBOARDING_PATH = "/onboarding/workspace"

export interface ActionError {
  error: string
}

export interface ActionInfo {
  ok: true
  message?: string
}

interface ApiErrorBody {
  message?: string
  error?: string
  detail?: string
  data?: { message?: string }
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as ApiErrorBody
    return (
      body.message ??
      body.error ??
      body.detail ??
      body.data?.message ??
      fallback
    )
  } catch {
    return fallback
  }
}

interface LoginApiResponse {
  success?: boolean
  message?: string
  data?: {
    requires2FA?: boolean
    message?: string
    user?: { id: string; email: string }
    requiresOnboarding?: boolean
  }
}

interface RegisterApiResponse {
  message?: string
  user?: { id: string; email: string }
  requiresOnboarding?: boolean
}

interface OrgApiResponse {
  success?: boolean
  message?: string
  data?: {
    organization?: { id: string; name: string; slug: string }
  }
}

// ===========================================================================
// /api/auth/login
// ===========================================================================

export async function loginAction(
  _prev: ActionError | null,
  formData: FormData
): Promise<ActionError | null> {
  const email = (formData.get("email") ?? "").toString().trim()
  const password = (formData.get("password") ?? "").toString()
  const totpCode =
    (formData.get("totpCode") ?? "").toString().trim() || undefined
  const backupCode =
    (formData.get("backupCode") ?? "").toString().trim() || undefined

  if (!email || !password) {
    return { error: "Please enter email and password" }
  }

  const res = await fetch(`${env.publicApiUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ email, password, totpCode, backupCode }),
    cache: "no-store",
  })

  if (!res.ok) {
    return { error: await readErrorMessage(res, "Invalid credentials") }
  }

  const body = (await res.json().catch(() => ({}))) as LoginApiResponse

  // 2FA required — bounce back to the form so it can render the TOTP UI.
  if (body.data?.requires2FA) {
    return { error: "REQUIRES_2FA" }
  }

  const forwarded = await forwardSessionCookie(res.headers.get("set-cookie"))
  if (!forwarded) {
    return { error: "Login succeeded but no session cookie was returned" }
  }

  // Login responses don't include an explicit requiresOnboarding flag
  // (only /register does), so always send the user to /organization. If they
  // have no org membership the (app)/layout will bounce them to onboarding.
  redirect(body.data?.requiresOnboarding ? ONBOARDING_PATH : POST_LOGIN_PATH)
}

// ===========================================================================
// /api/auth/register
// ===========================================================================

export async function registerAction(
  _prev: ActionError | null,
  formData: FormData
): Promise<ActionError | null> {
  const email = (formData.get("email") ?? "").toString().trim()
  const password = (formData.get("password") ?? "").toString()

  if (!email || !password) {
    return { error: "Please enter email and password" }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long" }
  }

  const res = await fetch(`${env.publicApiUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  })

  if (!res.ok) {
    return { error: await readErrorMessage(res, "Failed to register") }
  }

  // Register always returns requiresOnboarding: true, but parse defensively.
  const body = (await res.json().catch(() => ({}))) as RegisterApiResponse

  const forwarded = await forwardSessionCookie(res.headers.get("set-cookie"))
  if (!forwarded) {
    return {
      error: "Registration succeeded but no session cookie was returned",
    }
  }

  redirect(
    body.requiresOnboarding === false ? POST_LOGIN_PATH : ONBOARDING_PATH
  )
}

// ===========================================================================
// /api/auth/logout
// ===========================================================================

export async function logoutAction(): Promise<void> {
  // Best-effort upstream logout; even if the API fails, we still clear the
  // local cookie so the browser can't replay a stale session.
  const cookieStore = await cookies()
  const session = cookieStore.get("cognia_session")?.value
  try {
    await fetch(`${env.publicApiUrl}/api/auth/logout`, {
      method: "POST",
      headers: session
        ? {
            cookie: `cognia_session=${session}`,
            accept: "application/json",
          }
        : { accept: "application/json" },
      cache: "no-store",
    })
  } catch {
    // ignore — we still clear the cookie below
  }

  await clearSessionCookie()
  redirect("/login")
}

// ===========================================================================
// /api/onboarding/workspace
// ===========================================================================

export async function createWorkspaceAction(
  _prev: ActionError | null,
  formData: FormData
): Promise<ActionError | null> {
  const name = (formData.get("name") ?? "").toString().trim()
  if (!name) {
    return { error: "Enter a workspace name to continue." }
  }

  const cookieStore = await cookies()
  const session = cookieStore.get("cognia_session")?.value
  if (!session) {
    redirect("/login")
  }

  const res = await fetch(`${env.publicApiUrl}/api/onboarding/workspace`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie: `cognia_session=${session}`,
    },
    body: JSON.stringify({ name }),
    cache: "no-store",
  })

  if (!res.ok) {
    return {
      error: await readErrorMessage(
        res,
        "Failed to create workspace. Try again."
      ),
    }
  }

  const body = (await res.json().catch(() => ({}))) as OrgApiResponse
  if (!body.data?.organization?.slug) {
    return { error: "Server did not return a workspace." }
  }

  redirect(POST_LOGIN_PATH)
}

// ===========================================================================
// /api/onboarding/accept-invite
// ===========================================================================

export async function acceptInviteAction(
  _prev: ActionError | null,
  formData: FormData
): Promise<ActionError | null> {
  const code = (formData.get("code") ?? "").toString().trim()
  if (!code) {
    return { error: "Paste your invite code to continue." }
  }

  const cookieStore = await cookies()
  const session = cookieStore.get("cognia_session")?.value
  if (!session) {
    redirect("/login")
  }

  const res = await fetch(`${env.publicApiUrl}/api/onboarding/accept-invite`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie: `cognia_session=${session}`,
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  })

  if (!res.ok) {
    return {
      error: await readErrorMessage(res, "Invite code is invalid or expired."),
    }
  }

  const body = (await res.json().catch(() => ({}))) as OrgApiResponse
  if (!body.data?.organization?.slug) {
    return { error: "Server did not return a workspace." }
  }

  redirect(POST_LOGIN_PATH)
}

// ===========================================================================
// /api/auth/verify-email
// ===========================================================================

export async function verifyEmailAction(
  token: string
): Promise<ActionError | ActionInfo> {
  if (!token) return { error: "Missing verification token." }

  // The API exposes verify-email as POST { token }. We call it server-side
  // so the page can render the result without a client round-trip.
  const res = await fetch(`${env.publicApiUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  })

  if (!res.ok) {
    return { error: await readErrorMessage(res, "Verification failed") }
  }

  // Verification doesn't issue a session, but if the API ever does we forward
  // it through anyway — cheap and harmless.
  await forwardSessionCookie(res.headers.get("set-cookie"))
  return { ok: true, message: "Email verified" }
}

// ===========================================================================
// /api/auth/magic-link/send (request a fresh sign-in link)
// ===========================================================================

export interface MagicLinkRequestState {
  ok?: true
  email?: string
  error?: string
}

/**
 * Sends a magic-link email. Returns a serialisable state shape so the
 * calling form can render a "check your email" panel via useActionState.
 *
 * Distinct from magicLinkAction below, which CONSUMES a token from a
 * link the user clicked in their inbox — opposite direction.
 */
export async function requestMagicLinkAction(
  _prev: MagicLinkRequestState | null,
  formData: FormData
): Promise<MagicLinkRequestState> {
  const email = (formData.get("email") ?? "").toString().trim()
  if (!email) {
    return { error: "Enter your email to receive a sign-in link." }
  }

  const res = await fetch(`${env.publicApiUrl}/api/auth/magic-link/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ email }),
    cache: "no-store",
  })

  if (!res.ok) {
    return {
      error: await readErrorMessage(
        res,
        "Could not send the sign-in link. Try again in a moment."
      ),
    }
  }

  return { ok: true, email }
}

// ===========================================================================
// /api/auth/magic-link/consume
// ===========================================================================

export async function magicLinkAction(
  token: string
): Promise<ActionError | null> {
  if (!token) return { error: "Missing sign-in token." }

  const res = await fetch(`${env.publicApiUrl}/api/auth/magic-link/consume`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  })

  if (!res.ok) {
    return {
      error: await readErrorMessage(
        res,
        "This link is invalid or has already been used."
      ),
    }
  }

  const forwarded = await forwardSessionCookie(res.headers.get("set-cookie"))
  if (!forwarded) {
    return { error: "Sign-in succeeded but no session cookie was returned" }
  }

  return null // caller redirects on null
}
