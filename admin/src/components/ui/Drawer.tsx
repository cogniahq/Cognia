import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: string
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-[480px]',
}: DrawerProps) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute top-0 right-0 h-full bg-white border-l border-gray-200 ${width} flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              [{title.toUpperCase()}]
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
