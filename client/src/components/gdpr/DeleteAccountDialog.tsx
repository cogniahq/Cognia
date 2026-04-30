import React, { useEffect, useState } from "react"
import { gdprService } from "@/services/gdpr.service"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduledFor: string | null
  onScheduled: (scheduledFor: string) => void
  onCancelled: () => void
}

const formatDate = (iso: string | null): string => {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  open,
  onOpenChange,
  scheduledFor,
  onScheduled,
  onCancelled,
}) => {
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setConfirmed(false)
  }, [open])

  const handleSchedule = async () => {
    setSubmitting(true)
    try {
      const res = await gdprService.scheduleDeletion()
      onScheduled(res.scheduledFor)
      toast.success(
        `Account deletion scheduled for ${formatDate(res.scheduledFor)}.`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not schedule deletion"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setSubmitting(true)
    try {
      await gdprService.cancelDeletion()
      onCancelled()
      toast.success("Account deletion cancelled.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not cancel deletion"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {scheduledFor ? "Account deletion scheduled" : "Delete my account"}
          </DialogTitle>
          <DialogDescription>
            {scheduledFor
              ? `Your account is scheduled to be permanently erased on ${formatDate(scheduledFor)}. You can cancel any time before then.`
              : "This will queue your account for permanent deletion in 30 days. You can cancel any time during the grace period."}
          </DialogDescription>
        </DialogHeader>

        {!scheduledFor && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <strong>Heads up.</strong> After 30 days we permanently erase your
              memories, profile, audit history, integrations, and any other
              personal data we hold for you. This cannot be undone.
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand my data will be erased after 30 days and that this
                action is irreversible.
              </span>
            </label>
          </div>
        )}

        <DialogFooter className="mt-4">
          {scheduledFor ? (
            <>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-800 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="px-3 py-1.5 rounded bg-zinc-900 text-white text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? "Cancelling..." : "Cancel deletion"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-800 hover:bg-gray-50"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={handleSchedule}
                disabled={!confirmed || submitting}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Scheduling..." : "Schedule deletion"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
