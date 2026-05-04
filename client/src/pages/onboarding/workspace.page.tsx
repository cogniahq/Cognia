import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { axiosInstance } from "@/utils/http"
import { useNavigate } from "react-router-dom"

import { LoadingSpinner } from "@/components/ui/loading-spinner"

type Mode = "create" | "join"

interface ApiOrgResponse {
  data?: {
    data?: { organization?: { id: string; name: string; slug: string } }
  }
}

/**
 * Forced onboarding wall.
 *
 * Reached by:
 *   1. Brand-new users right after /register (login page redirects).
 *   2. Anyone who has zero active OrganizationMember rows when they hit
 *      a gated /api/* route — the axios interceptor catches the
 *      403 NO_ORG_MEMBERSHIP and bounces them here.
 *
 * Two CTAs: "Create a workspace" (POST /api/onboarding/workspace) or
 * "I have an invite code" (POST /api/onboarding/accept-invite). On
 * success we trigger a checkAuth + force a hard reload so the
 * OrganizationProvider on the next page picks up the freshly created
 * membership without a stale cache.
 */
export function OnboardingWorkspace() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuth()
  const [mode, setMode] = useState<Mode>("create")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The wall is only meaningful for authenticated users; bounce
  // anonymous traffic to /login.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  const onSuccess = async (slug: string) => {
    // Refresh the auth context so /me + permissions reflect the new
    // membership, then navigate to the org workspace. Hard reload so the
    // OrganizationProvider re-fetches the user's orgs (it only loads on
    // mount).
    try {
      localStorage.setItem("currentOrgSlug", slug)
    } catch {
      // ignore
    }
    try {
      await checkAuth()
    } catch {
      // ignore
    }
    window.location.href = "/organization"
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Enter a workspace name to continue.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = (await axiosInstance.post("/onboarding/workspace", {
        name: name.trim(),
      })) as ApiOrgResponse
      const org = res.data?.data?.organization
      if (!org?.slug) throw new Error("Server did not return a workspace.")
      await onSuccess(org.slug)
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        e.response?.data?.message ||
          e.message ||
          "Failed to create workspace. Try again."
      )
      setBusy(false)
    }
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError("Paste your invite code to continue.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = (await axiosInstance.post("/onboarding/accept-invite", {
        code: code.trim(),
      })) as ApiOrgResponse
      const org = res.data?.data?.organization
      if (!org?.slug) throw new Error("Server did not return a workspace.")
      await onSuccess(org.slug)
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        e.response?.data?.message ||
          e.message ||
          "Invite code is invalid or expired."
      )
      setBusy(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen text-black font-primary"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/black-transparent.png"
                alt="Cognia"
                className="w-10 h-10"
              />
              <div className="flex flex-col text-left">
                <span className="text-xl font-bold text-italics font-editorial text-black">
                  Welcome to Cognia
                </span>
                <span className="text-xs text-gray-600 font-mono -mt-1">
                  One last step before you get started
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Cognia organizes memories into shared workspaces. Create your own,
              or join an existing one with an invite code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setMode("create")
                setError(null)
              }}
              className={
                "text-left p-5 border bg-white/80 backdrop-blur transition-colors " +
                (mode === "create"
                  ? "border-black ring-1 ring-black"
                  : "border-gray-200 hover:border-gray-400")
              }
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">
                Option 1
              </div>
              <div className="text-base font-medium text-gray-900 mb-1">
                Create a workspace
              </div>
              <div className="text-xs text-gray-600">
                You become the admin and can invite teammates later.
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join")
                setError(null)
              }}
              className={
                "text-left p-5 border bg-white/80 backdrop-blur transition-colors " +
                (mode === "join"
                  ? "border-black ring-1 ring-black"
                  : "border-gray-200 hover:border-gray-400")
              }
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">
                Option 2
              </div>
              <div className="text-base font-medium text-gray-900 mb-1">
                I have an invite code
              </div>
              <div className="text-xs text-gray-600">
                Paste the token from your invite email or message.
              </div>
            </button>
          </div>

          <div className="mt-6 bg-white/80 backdrop-blur border border-gray-200 p-6">
            {mode === "create" ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label
                    htmlFor="workspace-name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Workspace name
                  </label>
                  <input
                    id="workspace-name"
                    name="workspace-name"
                    type="text"
                    required
                    autoFocus
                    className="block w-full px-4 py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                    placeholder="e.g. Acme Research"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setError(null)
                    }}
                    disabled={busy}
                    maxLength={64}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    You can rename it any time from workspace settings.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-4 py-2.5 bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy ? "Creating workspace..." : "Create workspace"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAccept} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-code"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Invite code
                  </label>
                  <input
                    id="invite-code"
                    name="invite-code"
                    type="text"
                    required
                    autoFocus
                    className="block w-full px-4 py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm font-mono"
                    placeholder="paste-your-token-here"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setError(null)
                    }}
                    disabled={busy}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Find this in the invite email your workspace admin sent you.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-4 py-2.5 bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy ? "Joining workspace..." : "Accept invite"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWorkspace
