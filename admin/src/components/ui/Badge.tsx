interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

const variants = {
  default: 'bg-muted text-muted-foreground border-border',
  success: 'bg-chart-success/10 text-chart-success border-chart-success/20',
  warning: 'bg-chart-warning/10 text-chart-warning border-chart-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-chart-accent/10 text-chart-accent border-chart-accent/20',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 text-xs font-mono uppercase tracking-wide
        border rounded-md ${variants[variant]}
      `}
    >
      {children}
    </span>
  )
}
