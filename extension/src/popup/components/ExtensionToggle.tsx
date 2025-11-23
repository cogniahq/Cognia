import React from 'react'

interface ExtensionToggleProps {
  extensionEnabled: boolean
  isLoading: boolean
  onToggle: () => void
}

export const ExtensionToggle: React.FC<ExtensionToggleProps> = ({
  extensionEnabled,
  isLoading,
  onToggle,
}) => {
  return (
    <div className="border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-black mb-0.5">Extension</div>
          <div className="text-xs text-gray-600">{extensionEnabled ? 'Active' : 'Disabled'}</div>
        </div>
        <button
          onClick={onToggle}
          disabled={isLoading}
          className={`px-4 py-1.5 text-xs font-medium border transition-colors ${
            extensionEnabled
              ? 'border-black bg-black text-white hover:bg-gray-800'
              : 'border-gray-300 bg-white text-black hover:bg-gray-50'
          }`}
        >
          {isLoading ? '...' : extensionEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
