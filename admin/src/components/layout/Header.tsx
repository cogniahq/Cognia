import { format } from 'date-fns'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            [{title.toUpperCase()}]
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="text-xs font-mono text-gray-400">
          {format(new Date(), 'yyyy-MM-dd HH:mm')}
        </div>
      </div>
    </header>
  )
}
