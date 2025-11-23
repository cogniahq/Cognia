import React, { useEffect, useRef } from "react"
import { Search, X } from "lucide-react"

interface SpotlightSearchInputProps {
  searchQuery: string
  isEmbeddingOnly: boolean
  onSearchQueryChange: (query: string) => void
  onEmbeddingOnlyChange: (value: boolean) => void
  onClose: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isOpen: boolean
}

export const SpotlightSearchInput: React.FC<SpotlightSearchInputProps> = ({
  searchQuery,
  isEmbeddingOnly,
  onSearchQueryChange,
  onEmbeddingOnlyChange,
  onClose,
  onKeyDown,
  isOpen,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
        />
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
          Mode:
        </span>
        <div className="inline-flex border border-gray-200">
          <button
            type="button"
            onClick={() => onEmbeddingOnlyChange(true)}
            className={`px-3 py-1 text-[11px] font-mono uppercase ${
              isEmbeddingOnly
                ? "bg-black text-white"
                : "bg-white text-gray-600"
            }`}
          >
            Embedding
          </button>
          <button
            type="button"
            onClick={() => onEmbeddingOnlyChange(false)}
            className={`px-3 py-1 text-[11px] font-mono uppercase border-l border-gray-200 ${
              !isEmbeddingOnly
                ? "bg-black text-white"
                : "bg-white text-gray-600"
            }`}
          >
            Summarized
          </button>
        </div>
      </div>
    </div>
  )
}

