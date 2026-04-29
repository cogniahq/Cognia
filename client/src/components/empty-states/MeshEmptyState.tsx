import React from "react"

interface MeshEmptyStateProps {
  onInstallExtension?: () => void
}

/**
 * Empty state for the memory mesh visualization page when no nodes exist.
 * Mirrors the MemoriesEmptyState style but tailored for the graph view.
 */
export const MeshEmptyState: React.FC<MeshEmptyStateProps> = ({
  onInstallExtension,
}) => {
  const handleInstall =
    onInstallExtension ||
    (() =>
      window.open(
        "https://chromewebstore.google.com/search/cognia",
        "_blank",
        "noopener,noreferrer"
      ))

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 mb-6 flex items-center justify-center border border-gray-200 rounded-xl bg-white shadow-sm">
        <svg
          className="w-8 h-8 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </div>
      <h2 className="text-2xl font-light font-editorial text-gray-900 mb-2">
        Your memory mesh is empty
      </h2>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        The mesh comes alive once you've captured a few memories. Connections
        and clusters form automatically as Cognia learns what matters to you.
      </p>
      <button
        onClick={handleInstall}
        className="px-5 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black transition-colors"
      >
        Install the extension
      </button>
    </div>
  )
}

export default MeshEmptyState
