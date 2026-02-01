import { ReactNode } from "react"

interface SetupDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SetupDrawer({ open, onClose, title, children }: SetupDrawerProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white border-l border-gray-200 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="text-xs font-mono text-gray-500 hover:text-gray-900 uppercase tracking-wider"
          >
            ← Back
          </button>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            [{title}]
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono text-gray-500 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  )
}
