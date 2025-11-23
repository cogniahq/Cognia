import React from "react"

interface SpotlightSearchAnswerProps {
  processedAnswer: string | null
  isSearching: boolean
}

export const SpotlightSearchAnswer: React.FC<SpotlightSearchAnswerProps> = ({
  processedAnswer,
  isSearching,
}) => {
  if (isSearching || !processedAnswer) {
    return null
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
        Answer
      </div>
      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
        {processedAnswer}
      </p>
    </div>
  )
}

