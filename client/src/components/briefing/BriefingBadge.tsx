import { useEffect, useState } from "react"
import { getUnreadCount } from "@/services/briefing/briefing.service"

interface BriefingBadgeProps {
  className?: string
}

export default function BriefingBadge({ className = "" }: BriefingBadgeProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetch = () => {
      getUnreadCount()
        .then(setCount)
        .catch(() => {})
    }
    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) return null

  return (
    <span
      className={`min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1 ${className}`}
    >
      {count}
    </span>
  )
}
