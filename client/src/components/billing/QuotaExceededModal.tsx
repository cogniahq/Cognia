import React, { useEffect, useState } from "react"
import { formatLimit } from "@/data/plans"
import {
  QUOTA_EXCEEDED_EVENT,
  type QuotaExceededDetail,
  type QuotaExceededKind,
} from "@/services/billing.service"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const HEADLINES: Record<QuotaExceededKind, string> = {
  seats: "You've hit your seat limit",
  memories: "You've hit your memory limit",
  integrations: "You've hit your integration limit",
}

const SUBLINES: Record<QuotaExceededKind, string> = {
  seats:
    "Your plan doesn't include any more seats. Upgrade to invite more teammates.",
  memories:
    "Your plan doesn't allow more memories. Upgrade to keep saving knowledge.",
  integrations:
    "Your plan doesn't allow more integrations. Upgrade to connect more sources.",
}

interface QuotaExceededModalProps {
  /** When provided, the modal is fully controlled (used for tests). */
  detail?: QuotaExceededDetail | null
  open?: boolean
  onClose?: () => void
}

/**
 * QuotaExceededModal
 *
 * In standalone mode (no `detail`/`open` props), it listens for the global
 * `cognia:quota-exceeded` event dispatched by the billing service when the
 * API returns 402 QUOTA_EXCEEDED, and shows itself.
 *
 * In controlled mode, the parent passes `detail` + `open` and handles `onClose`.
 */
export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  detail: detailProp,
  open: openProp,
  onClose,
}) => {
  const navigate = useNavigate()
  const [internalDetail, setInternalDetail] =
    useState<QuotaExceededDetail | null>(null)
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = detailProp !== undefined || openProp !== undefined
  const detail = isControlled ? (detailProp ?? null) : internalDetail
  const open = isControlled ? !!openProp : internalOpen

  useEffect(() => {
    if (isControlled) return
    const handler = (e: Event) => {
      const ce = e as CustomEvent<QuotaExceededDetail>
      if (!ce.detail) return
      setInternalDetail(ce.detail)
      setInternalOpen(true)
    }
    window.addEventListener(QUOTA_EXCEEDED_EVENT, handler as EventListener)
    return () => {
      window.removeEventListener(QUOTA_EXCEEDED_EVENT, handler as EventListener)
    }
  }, [isControlled])

  const handleOpenChange = (next: boolean) => {
    if (next) return
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleUpgrade = () => {
    handleOpenChange(false)
    navigate("/billing")
  }

  if (!detail) return null

  const headline = HEADLINES[detail.quotaExceeded] ?? "Quota exceeded"
  const subline = SUBLINES[detail.quotaExceeded] ?? "Upgrade to continue."

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{subline}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-sm text-gray-700">
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Plan
            </span>
            <span className="font-medium capitalize">{detail.plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Usage
            </span>
            <span className="font-medium">
              {detail.current.toLocaleString()} / {formatLimit(detail.limit)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={handleUpgrade}>Upgrade your plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuotaExceededModal
