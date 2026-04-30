import { useCallback, useEffect, useState } from "react"
import {
  identityService,
  type CreatedScimToken,
  type ScimToken,
} from "@/services/identity.service"
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

interface ScimTokensManagerProps {
  slug: string
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ScimTokensManager({ slug }: ScimTokensManagerProps) {
  const [tokens, setTokens] = useState<ScimToken[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const [created, setCreated] = useState<CreatedScimToken | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)

  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await identityService.listScimTokens(slug)
      setTokens(res?.data ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load SCIM tokens"
      )
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await identityService.createScimToken(
        slug,
        newName.trim() || undefined
      )
      const tok = res?.data
      if (!tok?.token) {
        throw new Error("Server did not return a token")
      }
      setCreated(tok)
      setShowCreate(false)
      setNewName("")
      setAcknowledged(false)
      setCopied(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token")
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!created?.token) return
    try {
      await navigator.clipboard.writeText(created.token)
      setCopied(true)
      toast.success("Token copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  const handleRevoke = async (tokenId: string) => {
    setRevokingId(tokenId)
    try {
      await identityService.revokeScimToken(slug, tokenId)
      toast.success("Token revoked")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs font-medium px-3 py-1.5 bg-gray-900 text-white hover:bg-black"
        >
          + New token
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50 text-[10px] font-mono uppercase tracking-wide text-gray-500">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Prefix</div>
          <div className="col-span-3">Last used</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1" />
        </div>
        {isLoading && tokens.length === 0 ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading tokens...</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            No SCIM tokens yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tokens.map((t) => {
              const isRevoked = !!t.revoked_at
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-12 gap-3 items-center px-4 py-3 text-sm"
                >
                  <div className="col-span-3 text-gray-900 truncate">
                    {t.name || "—"}
                  </div>
                  <div className="col-span-3 font-mono text-xs text-gray-700">
                    {t.prefix}…
                  </div>
                  <div className="col-span-3 text-xs text-gray-500">
                    {formatDate(t.last_used_at)}
                  </div>
                  <div className="col-span-2">
                    {isRevoked ? (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-mono text-red-700">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-mono text-green-700">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    {!isRevoked && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(t.id)}
                        disabled={revokingId === t.id}
                        className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                      >
                        {revokingId === t.id ? "..." : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!creating) setShowCreate(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New SCIM token</DialogTitle>
            <DialogDescription>
              Give this token a friendly name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label
              htmlFor="scim-token-name"
              className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-1.5"
            >
              Name (optional)
            </label>
            <input
              id="scim-token-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Okta production"
              className="block w-full px-3 py-2 border border-gray-300 rounded-none text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              disabled={creating}
            />
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
              {creating ? "Generating..." : "Generate"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created token modal — token shown ONCE */}
      <Dialog
        open={!!created}
        onOpenChange={(open) => {
          if (!open && acknowledged) {
            setCreated(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your token</DialogTitle>
            <DialogDescription>
              This is the only time we'll show the full token. Store it
              somewhere secure (e.g. your IdP's SCIM connector).
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <div className="border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-900 break-all">
                {created.token}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50 w-full"
              >
                {copied ? "Copied" : "Copy token"}
              </button>
              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I've saved this token securely.</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreated(null)}
              disabled={!acknowledged}
              className="text-xs font-medium px-3 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
