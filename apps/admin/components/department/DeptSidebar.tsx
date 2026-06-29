'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, Moon, Code2, DollarSign, Users2, LayoutDashboard, Eye } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import LogoutButton from '@/components/auth/LogoutButton'
import { useStaffInfo } from '@/lib/staff-cookies'
import SessionWatcher from '@/components/auth/SessionWatcher'

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
  isSuperAdmin?: boolean  // kept for backwards compat — permissions now come from cookies
}

const ACCENT = {
  tech: {
    gradient:    'from-cyan-500 to-blue-600',
    activeBg:    'rgba(6,182,212,0.1)',
    activeBorder:'#06B6D4',
    roleText:    'text-cyan-400',
    logoIcon:    <Code2 size={14} color="white" strokeWidth={2.5} />,
  },
  finance: {
    gradient:    'from-emerald-500 to-teal-600',
    activeBg:    'rgba(16,185,129,0.1)',
    activeBorder:'#10B981',
    roleText:    'text-emerald-400',
    logoIcon:    <DollarSign size={14} color="white" strokeWidth={2.5} />,
  },
  ops: {
    gradient:    'from-amber-500 to-orange-600',
    activeBg:    'rgba(245,158,11,0.1)',
    activeBorder:'#F59E0B',
    roleText:    'text-amber-400',
    logoIcon:    <Users2 size={14} color="white" strokeWidth={2.5} />,
  },
}

const ALL_ROOMS = [
  { key: 'admin',      label: 'Admin Panel',     href: '/dashboard',      icon: <LayoutDashboard size={11} />, cls: 'text-indigo-400 hover:bg-indigo-500/10'  },
  { key: 'management', label: 'Management Room', href: '/ops/dashboard',  icon: <Users2 size={11} />,          cls: 'text-amber-400 hover:bg-amber-500/10'    },
  { key: 'technical',  label: 'Technical Room',  href: '/tech/dashboard', icon: <Code2 size={11} />,           cls: 'text-cyan-400 hover:bg-cyan-500/10'      },
  { key: 'finance',    label: 'Finance Room',    href: '/finance/dashboard', icon: <DollarSign size={11} />,  cls: 'text-emerald-400 hover:bg-emerald-500/10' },
]

const COLOR_TO_ROOM_KEY: Record<DeptSidebarProps['color'], string> = {
  ops:     'management',
  tech:    'technical',
  finance: 'finance',
}

function initials(name: string): string {
  if (!name.trim()) return 'ST'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function DeptSidebar({ color, roomLabel, navGroups }: DeptSidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { role, name, permissions } = useStaffInfo()
  const a = ACCENT[color]
  const currentRoomKey = COLOR_TO_ROOM_KEY[color]

  const switchableRooms = ALL_ROOMS.filter(
    r => r.key !== currentRoomKey && permissions[r.key as keyof typeof permissions]
  )

  const isViewer    = role === 'viewer'
  const displayName = name || 'Staff Member'
  const roleLabel   = isViewer     ? 'View Only'  :
                      role === 'superadmin' ? 'Super Admin' :
                      role === 'admin'      ? 'Admin'       : 'Staff'

  return (
    <aside
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
    >
      <SessionWatcher />
      {/* Room header */}
      <div
        style={{ borderColor: 'var(--border)' }}
        className="px-5 h-[60px] flex items-center gap-3 border-b flex-shrink-0"
      >
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${a.gradient}
          flex items-center justify-center shadow-md flex-shrink-0`}>
          {a.logoIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold font-display leading-none tracking-tight"
            style={{ color: 'var(--tx-1)' }}>
            Workstation
          </p>
          <p className={`text-[10px] font-mono uppercase tracking-[0.12em] mt-1 ${a.roleText}`}>
            {roomLabel}
          </p>
        </div>
        {isViewer && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide
            bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
            <Eye size={9} />
            View
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em] px-3 mb-1.5"
              style={{ color: 'var(--tx-3)' }}
            >
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`group flex items-center justify-between px-3 py-[7px] rounded-lg
                        text-[13px] font-medium transition-all duration-150
                        ${isActive ? 'border-l-2 pl-[10px]' : 'border-l-2 border-transparent pl-[10px]'}`}
                      style={{
                        borderColor:     isActive ? a.activeBorder : undefined,
                        backgroundColor: isActive ? a.activeBg : undefined,
                        color: isActive ? a.activeBorder : 'var(--tx-2)',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-2)'
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span style={{ color: isActive ? a.activeBorder : 'var(--tx-3)' }}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-[10px] font-bold bg-rose-500/15 text-rose-400
                          border border-rose-500/30 rounded-full px-1.5 min-w-[18px]
                          text-center leading-[18px] flex-shrink-0">
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

      {/* Footer dock */}
      <div
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        className="px-4 py-3.5 border-t flex-shrink-0 space-y-2"
      >
        {/* Room switcher — only shown when user has access to other rooms */}
        {switchableRooms.length > 0 && (
          <div className="space-y-0.5 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] mb-1 px-1"
              style={{ color: 'var(--tx-3)' }}>
              Switch Room
            </p>
            {switchableRooms.map(r => (
              <Link
                key={r.key}
                href={r.href}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px]
                  font-medium transition-all duration-150 ${r.cls}`}
              >
                {r.icon}
                <span>{r.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.gradient}
            flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white text-[11px] font-bold">{initials(displayName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-none truncate" style={{ color: 'var(--tx-1)' }}>
              {displayName}
            </p>
            <p className={`text-[11px] font-medium leading-none mt-1 ${isViewer ? 'text-yellow-400' : a.roleText}`}>
              {roleLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 flex-shrink-0"
              style={{ color: 'var(--tx-3)' }}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
                ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <LogoutButton
              showLabel={false}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 flex-shrink-0"
              style={{ color: 'var(--tx-3)' } as React.CSSProperties}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
                ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
