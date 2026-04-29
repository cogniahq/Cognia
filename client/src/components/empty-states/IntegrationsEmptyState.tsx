import React from "react"

interface IntegrationsEmptyStateProps {
  onContact?: () => void
}

/**
 * Empty state for the integrations page when no providers are configured /
 * available in the current environment.
 */
export const IntegrationsEmptyState: React.FC<IntegrationsEmptyStateProps> = ({
  onContact,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-lg mx-auto border border-gray-200 bg-white">
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
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-light font-editorial text-gray-900 mb-2">
        No integrations available
      </h2>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed">
        Integrations let Cognia pull in context from the tools you already use —
        Slack, Google Drive, Notion, GitHub, and more. None are configured for
        this environment yet.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {onContact ? (
          <button
            onClick={onContact}
            className="px-5 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black transition-colors"
          >
            Request an integration
          </button>
        ) : (
          <a
            href="mailto:hello@cognia.so?subject=Integration%20request"
            className="px-5 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black transition-colors"
          >
            Request an integration
          </a>
        )}
        <a
          href="/pricing"
          className="px-5 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 hover:border-black hover:bg-gray-50 transition-colors"
        >
          See plan limits
        </a>
      </div>
    </div>
  )
}

export default IntegrationsEmptyState
