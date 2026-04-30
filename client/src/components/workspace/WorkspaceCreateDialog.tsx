import React, { useState } from "react"
import { workspaceService, type Workspace } from "@/services/workspace.service"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface WorkspaceCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgSlug: string
  parentId?: string | null
  onCreated?: (workspace: Workspace) => void
}

export const WorkspaceCreateDialog: React.FC<WorkspaceCreateDialogProps> = ({
  open,
  onOpenChange,
  orgSlug,
  parentId,
  onCreated,
}) => {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await workspaceService.create(orgSlug, {
        name: name.trim(),
        parentId: parentId || undefined,
      })
      setName("")
      onCreated?.(res.data)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            Workspaces group related memories within your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Engineering"
            autoFocus
          />
        </div>

        {error && <div className="text-sm text-red-600 font-mono">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default WorkspaceCreateDialog
