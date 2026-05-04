import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  SCOPE_DESCRIPTIONS,
  VALID_SCOPES,
  type ApiKeyMetadata,
  type ApiKeyScope,
  type ApiKeyWithPlaintext,
} from "@/services/api-keys/api-keys.service"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ApiKeyManagerProps {
  /**
   * If provided, all keys created and listed here are scoped to this org.
   * Pass `undefined` for the personal-account context.
   */
  organizationId?: string
  /** Display label for the org context (slug). Used to render the "Org" column. */
  organizationLabel?: string
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never"
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const diffMs = Date.now() - then
  if (diffMs < 0) return "Just now"
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mo ago`
  const year = Math.floor(day / 365)
  return `${year}y ago`
}

function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

function buildCurlExample(token: string): string {
  return [
    "curl https://api.cogniahq.tech/v1/search \\",
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"query":"hello","limit":10}'`,
  ].join("\n")
}

export function ApiKeyManager({
  organizationId,
  organizationLabel,
}: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newScopes, setNewScopes] = useState<ApiKeyScope[]>([
    "memories.read",
    "search",
  ])
  const [creating, setCreating] = useState(false)

  // Plaintext-once banner state
  const [created, setCreated] = useState<ApiKeyWithPlaintext | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  // Revoke confirm dialog state
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyMetadata | null>(null)
  const [revoking, setRevoking] = useState(false)

  const visibleKeys = useMemo(() => {
    if (organizationId) {
      return keys.filter((k) => k.organization_id === organizationId)
    }
    return keys.filter((k) => !k.organization_id)
  }, [keys, organizationId])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await listApiKeys(organizationId)
      setKeys(data)
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load API keys"
      )
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    load()
  }, [load])

  const toggleScope = (scope: ApiKeyScope) => {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  const resetCreateForm = () => {
    setNewName("")
    setNewScopes(["memories.read", "search"])
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      toast.error("Name is required")
      return
    }
    if (newScopes.length === 0) {
      toast.error("Select at least one scope")
      return
    }
    setCreating(true)
    try {
      const result = await createApiKey({
        name: trimmed,
        scopes: newScopes,
        organizationId,
      })
      if (!result?.token) {
        throw new Error("Server did not return a token")
      }
      setCreated(result)
      setShowCreate(false)
      resetCreateForm()
      setAcknowledged(false)
      setCopiedKey(false)
      setCopiedCurl(false)
      await load()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create API key"
      )
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = async () => {
    if (!created?.token) return
    try {
      await navigator.clipboard.writeText(created.token)
      setCopiedKey(true)
      toast.success("Key copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  const handleCopyCurl = async () => {
    if (!created?.token) return
    try {
      await navigator.clipboard.writeText(buildCurlExample(created.token))
      setCopiedCurl(true)
      toast.success("curl example copied")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeApiKey(revokeTarget.id)
      toast.success(`Revoked "${revokeTarget.name}"`)
      setRevokeTarget(null)
      await load()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke API key"
      )
    } finally {
      setRevoking(false)
    }
  }

  const orgColumnLabel = organizationLabel ?? (organizationId ? "Org" : "—")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">API keys</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Programmatic access to the Cognia API. Use these keys with the
            <code className="font-mono px-1 mx-0.5 bg-gray-100 rounded">
              /v1
            </code>
            endpoints and the MCP server. Each key is shown exactly once at
            creation — store it somewhere secure.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs font-medium px-3 py-1.5 bg-gray-900 text-white hover:bg-black whitespace-nowrap"
        >
          + Create API key
        </button>
      </div>

      {loadError && (
        <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
          {loadError}
        </div>
      )}

      {/* Keys table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && visibleKeys.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading API keys...</span>
          </div>
        ) : visibleKeys.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">No API keys yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Mint your first key to start hitting{" "}
              <code className="font-mono">/v1</code>.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 text-xs font-medium px-3 py-1.5 bg-gray-900 text-white hover:bg-black"
            >
              Create your first key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-mono">Name</th>
                  <th className="text-left px-4 py-2.5 font-mono">Prefix</th>
                  <th className="text-left px-4 py-2.5 font-mono">Scopes</th>
                  <th className="text-left px-4 py-2.5 font-mono">Org</th>
                  <th className="text-left px-4 py-2.5 font-mono">Last used</th>
                  <th className="text-left px-4 py-2.5 font-mono">Created</th>
                  <th className="text-left px-4 py-2.5 font-mono">Status</th>
                  <th className="text-right px-4 py-2.5 font-mono">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleKeys.map((key) => {
                  const isRevoked = !!key.revoked_at
                  return (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900 truncate max-w-[200px]">
                        {key.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-700">
                        {key.prefix}…
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-mono text-gray-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">
                        {key.organization_id ? orgColumnLabel : "Personal"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600 whitespace-nowrap">
                        {formatRelative(key.last_used_at)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600 whitespace-nowrap">
                        {formatAbsolute(key.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isRevoked ? (
                          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-mono text-red-700">
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-mono text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => setRevokeTarget(key)}
                            className="text-xs font-mono text-gray-500 hover:text-red-600"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!creating) setShowCreate(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              {organizationId
                ? "This key will act on behalf of the organization."
                : "This key will act on behalf of your personal account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="api-key-name"
                className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-1.5"
              >
                Name
              </label>
              <input
                id="api-key-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production server"
                className="block w-full px-3 py-2 border border-gray-300 rounded-none text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                disabled={creating}
              />
            </div>

            <div>
              <span className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-2">
                Scopes
              </span>
              <div className="space-y-2">
                {VALID_SCOPES.map((scope) => {
                  const checked = newScopes.includes(scope)
                  return (
                    <label
                      key={scope}
                      htmlFor={`scope-${scope}`}
                      className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer"
                    >
                      <input
                        id={`scope-${scope}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScope(scope)}
                        disabled={creating}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-mono text-gray-900">{scope}</span>
                        <span className="block text-gray-500">
                          {SCOPE_DESCRIPTIONS[scope]}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={creating}
              className="text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="text-xs font-medium px-3 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-50 inline-flex items-center gap-2"
            >
              {creating && <Loader2 className="w-3 h-3 animate-spin" />}
              {creating ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plaintext-once banner — modal that cannot be dismissed by Esc/outside click */}
      <Dialog
        open={!!created}
        onOpenChange={(open) => {
          // Once acknowledged the user can dismiss; otherwise refuse.
          if (!open && acknowledged) {
            setCreated(null)
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(e) => {
            if (!acknowledged) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (!acknowledged) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!acknowledged) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogDescription>
              This is the only time the full key will be shown. Store it
              somewhere secure — you will not see it again.
            </DialogDescription>
          </DialogHeader>

          {created && (
            <div className="space-y-4">
              {/* Plaintext key */}
              <div>
                <span className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-1.5">
                  Key
                </span>
                <div
                  className="border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-900 break-all"
                  data-testid="plaintext-api-key"
                >
                  {created.token}
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="mt-2 text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50 w-full"
                >
                  {copiedKey ? "Copied" : "Copy key"}
                </button>
              </div>

              {/* curl helper */}
              <div>
                <span className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-1.5">
                  Try it with curl
                </span>
                <pre className="border border-gray-200 bg-gray-900 text-gray-100 px-3 py-3 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                  {buildCurlExample(created.token)}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="mt-2 text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50 w-full"
                >
                  {copiedCurl ? "Copied" : "Copy curl"}
                </button>
              </div>

              <div className="px-3 py-2 border border-amber-200 bg-amber-50 text-xs text-amber-900">
                Save this now — you will not see it again.
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I've saved this key.</span>
              </label>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                if (acknowledged) setCreated(null)
              }}
              disabled={!acknowledged}
              className="text-xs font-medium px-3 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!revoking && !open) setRevokeTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? `Revoke "${revokeTarget.name}"? This action cannot be undone — any service using this key will start failing.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
              className="text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevokeConfirm}
              disabled={revoking}
              className="text-xs font-medium px-3 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {revoking && <Loader2 className="w-3 h-3 animate-spin" />}
              {revoking ? "Revoking..." : "Revoke"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ApiKeyManager
