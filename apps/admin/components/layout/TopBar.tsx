'use client'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-20 backdrop-blur-sm border-b px-8 py-4"
      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold font-display"
            style={{ color: 'var(--tx-1)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--tx-2)' }}>{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}
