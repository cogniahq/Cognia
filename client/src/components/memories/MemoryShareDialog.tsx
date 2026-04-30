import React, { useEffect, useState } from "react"
import { shareService, type Share } from "@/services/share.service"
import { Copy, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MemoryShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memoryId: string
}

function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`
  return `${window.location.origin}/share/${token}`
}

export const MemoryShareDialog: React.FC<MemoryShareDialogProps> = ({
  open,
  onOpenChange,
  memoryId,
}) => {
  const [shares, setShares] = useState<Share[]>([])
  const [linkPermission, setLinkPermission] = useState<"read" | "comment">(
    "read"
  )
  const [linkExpiry, setLinkExpiry] = useState<string>("")
  const [userId, setUserId] = useState("")
  const [userPermission, setUserPermission] = useState<
    "read" | "comment" | "edit"
  >("read")
  const [orgId, setOrgId] = useState("")
  const [orgPermission, setOrgPermission] = useState<
    "read" | "comment" | "edit"
  >("read")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    shareService
      .list(memoryId)
      .then((res) => {
        if (!cancelled) setShares(res.data || [])
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load shares")
      })
    return () => {
      cancelled = true
    }
  }, [open, memoryId])

  const refresh = async () => {
    try {
      const res = await shareService.list(memoryId)
      setShares(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shares")
    }
  }

  const generateLink = async () => {
    setBusy(true)
    setError(null)
    try {
      await shareService.create({
        memoryId,
        recipientType: "link",
        permission: linkPermission,
        expiresAt: linkExpiry || undefined,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share")
    } finally {
      setBusy(false)
    }
  }

  const shareWithUser = async () => {
    if (!userId.trim()) return
    setBusy(true)
    setError(null)
    try {
      await shareService.create({
        memoryId,
        recipientType: "user",
        recipientUserId: userId.trim(),
        permission: userPermission,
      })
      setUserId("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share")
    } finally {
      setBusy(false)
    }
  }

  const shareWithOrg = async () => {
    if (!orgId.trim()) return
    setBusy(true)
    setError(null)
    try {
      await shareService.create({
        memoryId,
        recipientType: "organization",
        recipientOrgId: orgId.trim(),
        permission: orgPermission,
      })
      setOrgId("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share")
    } finally {
      setBusy(false)
    }
  }

  const removeShare = async (id: string) => {
    setError(null)
    try {
      await shareService.remove(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove share")
    }
  }

  const copyLink = async (token: string) => {
    const url = buildShareUrl(token)
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      // ignore copy failure
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Share memory</DialogTitle>
          <DialogDescription>
            Create a shareable link or share with a user or organization.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="user">User</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-permission">Permission</Label>
              <select
                id="link-permission"
                className="w-full h-10 px-3 border border-gray-300 rounded text-sm bg-white"
                value={linkPermission}
                onChange={(e) =>
                  setLinkPermission(e.target.value as "read" | "comment")
                }
              >
                <option value="read">View only</option>
                <option value="comment">Can comment</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-expiry">Expires at (optional)</Label>
              <Input
                id="link-expiry"
                type="datetime-local"
                value={linkExpiry}
                onChange={(e) => setLinkExpiry(e.target.value)}
              />
            </div>
            <Button
              onClick={generateLink}
              disabled={busy}
              data-testid="generate-link-button"
            >
              {busy ? "Generating..." : "Generate link"}
            </Button>
          </TabsContent>

          <TabsContent value="user" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="user-id">User ID or email</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-permission">Permission</Label>
              <select
                id="user-permission"
                className="w-full h-10 px-3 border border-gray-300 rounded text-sm bg-white"
                value={userPermission}
                onChange={(e) =>
                  setUserPermission(
                    e.target.value as "read" | "comment" | "edit"
                  )
                }
              >
                <option value="read">View only</option>
                <option value="comment">Can comment</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <Button onClick={shareWithUser} disabled={busy || !userId.trim()}>
              Share
            </Button>
          </TabsContent>

          <TabsContent value="organization" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-id">Organization ID or slug</Label>
              <Input
                id="org-id"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="acme-inc"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-permission">Permission</Label>
              <select
                id="org-permission"
                className="w-full h-10 px-3 border border-gray-300 rounded text-sm bg-white"
                value={orgPermission}
                onChange={(e) =>
                  setOrgPermission(
                    e.target.value as "read" | "comment" | "edit"
                  )
                }
              >
                <option value="read">View only</option>
                <option value="comment">Can comment</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <Button onClick={shareWithOrg} disabled={busy || !orgId.trim()}>
              Share
            </Button>
          </TabsContent>
        </Tabs>

        {error && <div className="text-sm text-red-600 font-mono">{error}</div>}

        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Existing shares
          </h4>
          {shares.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No shares yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
              {shares.map((s) => (
                <li
                  key={s.id}
                  className="px-3 py-2 flex items-center gap-2 text-sm"
                >
                  <span className="font-mono text-xs uppercase text-gray-500 w-24">
                    {s.recipient_type}
                  </span>
                  <span className="flex-1 truncate text-gray-800">
                    {s.recipient_type === "link"
                      ? s.token
                        ? buildShareUrl(s.token)
                        : "(pending token)"
                      : s.recipient_user_id || s.recipient_org_id}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">
                    {s.permission}
                  </span>
                  {s.recipient_type === "link" && s.token && (
                    <button
                      onClick={() => copyLink(s.token!)}
                      className="p-1 hover:bg-gray-100 rounded"
                      aria-label="Copy link"
                      data-testid={`copy-link-${s.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeShare(s.id)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                    aria-label="Revoke share"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {copiedToken && (
            <div className="text-xs text-green-700 font-mono">Link copied.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MemoryShareDialog
