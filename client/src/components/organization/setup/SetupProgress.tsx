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
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {completedSteps} of {totalSteps} steps complete
        </span>
        <span className="font-semibold text-gray-900">{percentComplete}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  )
}
