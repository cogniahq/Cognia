import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SecurityPromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfigureSecurity: () => void
  onSetUpLater: () => void
}

export function SecurityPromptModal({
  open,
  onOpenChange,
  onConfigureSecurity,
  onSetUpLater,
}: SecurityPromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-none">
        <DialogHeader>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            [SECURITY]
          </div>
          <DialogTitle className="text-lg font-bold">
            Secure Your Workspace
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Before your team joins, consider setting up:
          </p>

          <div className="space-y-2">
            <div className="p-3 bg-gray-50 border border-gray-200">
              <div className="text-sm text-gray-900">Two-factor authentication</div>
              <p className="text-xs text-gray-500">Require 2FA for all members</p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200">
              <div className="text-sm text-gray-900">Session timeout policies</div>
              <p className="text-xs text-gray-500">Auto-logout after inactivity</p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200">
              <div className="text-sm text-gray-900">Data residency</div>
              <p className="text-xs text-gray-500">Choose where data is stored</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onConfigureSecurity}
            className="w-full px-4 py-2 bg-gray-900 text-white text-xs font-mono hover:bg-gray-800 transition-colors"
          >
            Configure Security
          </button>
          <button
            onClick={onSetUpLater}
            className="w-full px-4 py-2 text-xs font-mono text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Set up later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
