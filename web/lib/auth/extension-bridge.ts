"use client";

/**
 * Browser-extension auth bridge. Mirrors
 * client/src/utils/auth/user-id.util.ts:setAuthToken — when the web app
 * authenticates, post a chrome.runtime message so the extension can
 * refresh its destinations cache and resolve the current user. The web
 * app uses HTTP-only cookies (cognia_session) rather than a JS-readable
 * JWT, so we cannot ship the raw token across; the extension already
 * has its own pathway to read the cookie + decode the user id (see
 * extension/src/lib/userId.ts:getUserId), so the bridge just needs to
 * signal "auth state changed".
 *
 * The function is a no-op when chrome.runtime isn't available (i.e.,
 * users who don't have the Cognia extension installed). That covers the
 * vast majority of traffic — by design.
 */

interface ChromeRuntimeApi {
  id?: string;
  sendMessage?: (
    extensionId: string,
    message: { type: string; userId?: string | null; token?: string | null },
  ) => Promise<unknown>;
}

interface WindowWithChrome extends Window {
  chrome?: { runtime?: ChromeRuntimeApi };
}

function getChromeRuntime(): ChromeRuntimeApi | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithChrome;
  const runtime = w.chrome?.runtime;
  if (!runtime?.id || typeof runtime.sendMessage !== "function") return null;
  return runtime;
}

/**
 * Notify the installed extension that the user is signed in. The message
 * shape matches the extension's existing SYNC_AUTH_TOKEN handler — we
 * pass the user id rather than a token because the web app no longer
 * stores a raw JWT in JS-accessible storage. Extension code falls back
 * to reading the cookie when the token field is absent.
 */
export function syncSessionToExtension(userId: string): void {
  const runtime = getChromeRuntime();
  if (!runtime?.sendMessage || !runtime.id) return;
  try {
    runtime
      .sendMessage(runtime.id, {
        type: "SYNC_AUTH_TOKEN",
        userId,
        token: null,
      })
      .catch(() => {
        // Extension might not be ready or installed for this id; ignore.
      });
  } catch {
    // Throwing during sendMessage is rare but possible (e.g., when the
    // extension was uninstalled mid-session). Swallow — there's nothing
    // useful to do with it on the web side.
  }
}

/**
 * Notify the extension that the user signed out. The extension keeps
 * cached destinations keyed by user id, so a logout signal lets it
 * invalidate that cache promptly rather than waiting for the next
 * cookie-expiry check.
 */
export function clearExtensionSession(): void {
  const runtime = getChromeRuntime();
  if (!runtime?.sendMessage || !runtime.id) return;
  try {
    runtime
      .sendMessage(runtime.id, {
        type: "CLEAR_AUTH_TOKEN",
        userId: null,
        token: null,
      })
      .catch(() => {
        // ignore
      });
  } catch {
    // ignore
  }
}
