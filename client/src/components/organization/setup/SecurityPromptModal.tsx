import { Shield, Lock, Clock, Globe } from "lucide-react"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Secure Your Workspace
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-center text-gray-600 mb-6">
            Before your team joins, consider setting up security policies:
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Lock className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-gray-900">
                  Two-factor authentication
                </span>
                <p className="text-gray-500">Require 2FA for all team members</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-gray-900">
                  Session timeout policies
                </span>
                <p className="text-gray-500">Auto-logout after inactivity</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Globe className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-gray-900">
                  Data residency preferences
                </span>
                <p className="text-gray-500">Choose where your data is stored</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onConfigureSecurity}
            className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            Configure Security
          </button>
          <button
            onClick={onSetUpLater}
            className="w-full px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            Set up later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
