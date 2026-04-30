import React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils.lib"

interface TagBadgeProps {
  name: string
  color?: string | null
  onRemove?: () => void
  onClick?: () => void
  selected?: boolean
  className?: string
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  name,
  color,
  onRemove,
  onClick,
  selected,
  className,
}) => {
  const style = color
    ? { backgroundColor: `${color}22`, borderColor: color, color }
    : undefined

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono",
        selected
          ? "bg-black text-white border-black"
          : "bg-gray-50 border-gray-300 text-gray-800",
        onClick ? "cursor-pointer hover:bg-gray-100" : "",
        className
      )}
      style={selected ? undefined : style}
      onClick={onClick}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
          aria-label={`Remove ${name}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}

export default TagBadge
