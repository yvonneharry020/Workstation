'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface DeptSidebarProps {
  color: 'tech' | 'finance' | 'ops'
  roomLabel: string
  navGroups: NavGroup[]
  isSuperAdmin?: boolean
}

const COLOR_MAP = {
  tech: {
    accent400: '#60A5FA',
    active: 'bg-blue-900/50 text-blue-300',
    activeIcon: 'text-blue-400',
    hoverBg: 'hover:bg-surface-elevated hover:text-text-primary',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-tech-500',
    logoBg: 'bg-tech-500',
  },
  finance: {
    accent400: '#34D399',
    active: 'bg-emerald-900/50 text-emerald-300',
    activeIcon: 'text-emerald-400',
    hoverBg: 'hover:bg-surface-elevated hover:text-text-primary',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-finance-500',
    logoBg: 'bg-finance-500',
  },
  ops: {
    accent400: '#FB923C',
    active: 'bg-orange-900/50 text-orange-300',
    activeIcon: 'text-orange-400',
    hoverBg: 'hover:bg-surface-elevated hover:text-text-primary',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-ops-500',
    logoBg: 'bg-ops-500',
  },
}

const ROOM_ICONS: Record<string, React.ReactNode> = {
  tech: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  finance: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  ops: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
}

export default function DeptSidebar({ color, roomLabel, navGroups, isSuperAdmin = false }: DeptSidebarProps) {
  const pathname = usePathname()
  const c = COLOR_MAP[color]

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${c.logoBg} flex items-center justify-center flex-shrink-0`}>
            {ROOM_ICONS[color]}
          </div>
          <div>
            <p className="text-sm font-semibold font-display text-text-primary leading-none">Workstation</p>
            <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: c.accent400 }}>{roomLabel}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? c.active : `text-text-secondary ${c.hoverBg}`}`}>
                      <div className="flex items-center gap-3">
                        <span className={isActive ? c.activeIcon : 'text-text-muted'}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={`text-[10px] font-mono font-bold border rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-tight ${c.badge}`}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {isSuperAdmin && (
        <div className="px-3 py-3 border-t border-surface-border">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Admin
          </Link>
        </div>
      )}

      <div className="px-5 py-3 border-t border-surface-border">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-[10px] text-text-muted font-mono">{roomLabel.toUpperCase()}</span>
        </div>
      </div>
    </aside>
  )
}
