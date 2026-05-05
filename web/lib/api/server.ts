import { cookies } from "next/headers"
import { env } from "../env"

/**
 * Server-only fetch helper. Forwards the cognia_session cookie to the API
 * so server components can read user/org state on behalf of the visitor.
 *
 * Use this from Server Components and Server Actions. Throws on non-2xx
 * unless { allowError: true } is passed.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { allowError?: boolean } = {}
): Promise<T> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("cognia_session")?.value
  const url = `${env.publicApiUrl}${path}`

  const headers = new Headers(init.headers)
  if (sessionCookie) {
    headers.set("cookie", `cognia_session=${sessionCookie}`)
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json")
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    // Default to no-store — server components are per-request anyway and
    // we don't want stale auth state. Caller can override.
    cache: init.cache ?? "no-store",
  })

  if (!res.ok && !init.allowError) {
    throw new ApiError(
      res.status,
      await safeText(res),
      `${init.method ?? "GET"} ${path}`
    )
  }

  // 204 / empty responses
  if (res.status === 204) return undefined as T

  return (await res.json()) as T
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly request: string
  ) {
    super(`API ${status} ${request}: ${body.slice(0, 200)}`)
    this.name = "ApiError"
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}
