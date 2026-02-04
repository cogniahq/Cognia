interface SetupProgressProps {
  completedSteps: number
  totalSteps: number
  percentComplete: number
}

export function SetupProgress({
  completedSteps,
  totalSteps,
  percentComplete,
}: SetupProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-gray-500 uppercase tracking-wider">
          {completedSteps}/{totalSteps} complete
        </span>
        <span className="text-gray-900">{percentComplete}%</span>
      </div>
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-gray-900 transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  )
}
