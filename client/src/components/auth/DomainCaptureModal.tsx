import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SsoDiscoveryResult } from "@/services/identity.service"

interface DomainCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  discovery: SsoDiscoveryResult | null
  onCreateOwn: () => void
}

/**
 * DomainCaptureModal — surfaced when a fresh sign-up email matches an
 * existing org's `sso_email_domains`. We invite the user to JIT-join via
 * the org's SSO loginUrl, otherwise they continue creating their own
 * workspace.
 */
export function DomainCaptureModal({
  open,
  onOpenChange,
  email,
  discovery,
  onCreateOwn,
}: DomainCaptureModalProps) {
  const orgName = discovery?.orgName ?? "an existing workspace"
  const domain = email.split("@")[1] ?? ""
  const canJoin = !!discovery?.loginUrl

  const handleJoin = () => {
    if (!discovery?.loginUrl) return
    window.location.href = discovery.loginUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join {orgName}?</DialogTitle>
          <DialogDescription>
            It looks like{" "}
            <span className="font-mono text-gray-900">{domain}</span> already
            has a Cognia workspace
            {discovery?.orgName ? ` (${discovery.orgName})` : ""}. You can join
            them with single sign-on, or continue creating your own.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={onCreateOwn}
            className="text-xs font-medium px-3 py-2 border border-gray-300 hover:bg-gray-50"
          >
            Create my own
          </button>
          <button
            type="button"
            onClick={handleJoin}
            disabled={!canJoin}
            className="text-xs font-medium px-3 py-2 bg-gray-900 text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join via SSO
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DomainCaptureModal
