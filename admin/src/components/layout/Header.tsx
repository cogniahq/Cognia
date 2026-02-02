import { format } from 'date-fns'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-0.5">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {format(new Date(), 'yyyy-MM-dd HH:mm')}
        </div>
      </div>
    </header>
  )
}
