import React from "react"

interface InfoCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export const InfoCard: React.FC<InfoCardProps> = ({
  children,
  className = "",
  hover = true,
}) => {
  const hoverClasses = hover
    ? "hover:border-black transition-all duration-300"
    : ""

  return (
    <div
      className={`bg-white border border-gray-200 p-6 ${hoverClasses} ${className}`}
    >
      {children}
    </div>
  )
}

interface InfoCardWithIconProps {
  icon: React.ReactNode
  title: string
  description: string
  features?: React.ReactNode[]
  className?: string
  hover?: boolean
}

export const InfoCardWithIcon: React.FC<InfoCardWithIconProps> = ({
  icon,
  title,
  description,
  features = [],
  className = "",
  hover = true,
}) => {
  return (
    <InfoCard className={className} hover={hover}>
      <div className="flex items-center space-x-3 mb-4">
        {icon}
        <h3 className="text-lg font-light">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      {features.length > 0 && (
        <div className="space-y-2 text-xs font-mono text-gray-500">
          {features.map((feature, index) => (
            <div key={index}>{feature}</div>
          ))}
        </div>
      )}
    </InfoCard>
  )
}
