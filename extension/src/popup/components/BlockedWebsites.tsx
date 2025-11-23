import React, { useState } from 'react'

interface BlockedWebsitesProps {
  blockedWebsites: string[]
  isLoading: boolean
  onAdd: (website: string) => void
  onRemove: (website: string) => void
  onBlockCurrentDomain: () => void
}

export const BlockedWebsites: React.FC<BlockedWebsitesProps> = ({
  blockedWebsites,
  isLoading,
  onAdd,
  onRemove,
  onBlockCurrentDomain,
}) => {
  const [newBlockedWebsite, setNewBlockedWebsite] = useState('')

  const handleAdd = () => {
    if (newBlockedWebsite.trim()) {
      onAdd(newBlockedWebsite.trim())
      setNewBlockedWebsite('')
    }
  }

  return (
    <div className="border border-gray-200 bg-white p-3 space-y-3">
      <div className="text-sm font-medium text-black">Blocked Websites</div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="example.com"
          value={newBlockedWebsite}
          onChange={e => setNewBlockedWebsite(e.target.value)}
          onKeyPress={e => {
            if (e.key === 'Enter') {
              handleAdd()
            }
          }}
          className="flex-1 border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-black"
        />
        <button
          onClick={handleAdd}
          disabled={isLoading || !newBlockedWebsite.trim()}
          className="px-3 py-1.5 text-xs font-medium border border-black bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <button
        onClick={onBlockCurrentDomain}
        disabled={isLoading}
        className="w-full px-3 py-1.5 text-xs font-medium border border-gray-300 bg-white text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Block Current Domain
      </button>

      {blockedWebsites.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {blockedWebsites.map((website, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100"
            >
              <span className="text-xs text-gray-700 truncate flex-1">{website}</span>
              <button
                onClick={() => onRemove(website)}
                disabled={isLoading}
                className="ml-2 px-2 py-0.5 text-xs text-gray-600 hover:text-black hover:underline disabled:opacity-50"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      {blockedWebsites.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">No websites blocked</div>
      )}
    </div>
  )
}
