import { useEffect, useState } from "react"
import { orgAdminService, type AdminMember } from "@/services/org-admin.service"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface OffboardDialogProps {
  slug: string
  member: AdminMember | null
  members: AdminMember[]
  open: boolean
  defaultHardDelete?: boolean
  onClose: () => void
  onCompleted: () => void
}

export default function OffboardDialog({
  slug,
  member,
  members,
  open,
  defaultHardDelete = false,
  onClose,
  onCompleted,
}: OffboardDialogProps) {
  const [reason, setReason] = useState("")
  const [reassignTo, setReassignTo] = useState<string>("")
  const [hardDelete, setHardDelete] = useState(defaultHardDelete)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setReassignTo("")
      setHardDelete(defaultHardDelete)
      setIsSubmitting(false)
    }
  }, [open, defaultHardDelete])

  if (!member) return null

  const reassignChoices = members.filter(
    (m) => m.id !== member.id && !m.deactivated_at
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member) return
    setIsSubmitting(true)
    try {
      await orgAdminService.offboardMember(slug, member.id, {
        hardDelete,
        reassignDocsToUserId: reassignTo || undefined,
        reason: reason.trim() || undefined,
      })
      toast.success(
        hardDelete ? "Member permanently removed" : "Member deactivated"
      )
      onCompleted()
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to offboard member"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md rounded-none">
        <DialogHeader>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            [OFFBOARD MEMBER]
          </div>
          <DialogTitle className="text-lg font-bold">
            {member.user?.email || "Member"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Left the company"
                className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Reassign documents to (optional)
              </label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-xs font-mono focus:outline-none focus:border-gray-900 rounded-none bg-white"
              >
                <option value="">— Keep with deactivated owner —</option>
                {reassignChoices.map((m) => (
                  <option key={m.id} value={m.user_id}>
                    {m.user?.email || m.user_id}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-2 cursor-pointer p-3 border border-gray-200 hover:border-gray-300 transition-colors">
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Permanently delete
                </div>
                <div className="text-xs text-gray-500">
                  Hard-deletes the membership and removes their access. Leave
                  unchecked to soft-deactivate (revocable).
                </div>
              </div>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-mono text-white transition-colors disabled:opacity-50 ${
                hardDelete
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-900 hover:bg-gray-800"
              }`}
            >
              {isSubmitting
                ? "Working..."
                : hardDelete
                  ? "Remove permanently"
                  : "Deactivate"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
