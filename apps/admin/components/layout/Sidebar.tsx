'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Bell, TicketCheck, Inbox, MessageSquare,
  BarChart3, ScrollText, UserCog, Settings2, Sun, Moon,
  Layers, Shield, BookOpen, PlayCircle, Timer, TrendingUp, Clock, CalendarClock, Database,
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import LogoutButton from '@/components/auth/LogoutButton'
import { useStaffInfo } from '@/lib/staff-cookies'
import SessionWatcher from '@/components/auth/SessionWatcher'
import ClockWidget from '@/components/clock/ClockWidget'

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

function initials(name: string): string {
  if (!name.trim()) return 'YH'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { name, role } = useStaffInfo()
  const [adminInboxCount, setAdminInboxCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function fetchInboxCount() {
      const { count } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('department', 'Admin')
        .not('status', 'in', '("resolved","closed")')
      setAdminInboxCount(count ?? 0)
    }

    void fetchInboxCount()

    const channel = supabase
      .channel('admin-inbox-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void fetchInboxCount())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
      ],
    },
    {
      label: 'Management',
      items: [
        { href: '/users', label: 'User Management', icon: <Users size={15} /> },
      ],
    },
    {
      label: 'Ticket Center',
      items: [
        { href: '/ticket-overview', label: 'Ticket Overview', icon: <TicketCheck size={15} /> },
        { href: '/admin-inbox',     label: 'Admin Inbox',     icon: <Inbox       size={15} />, badge: adminInboxCount },
      ],
    },
    {
      label: 'Internal',
      items: [
        { href: '/staff-comms', label: '# general', icon: <MessageSquare size={15} /> },
      ],
    },
    {
      label: 'Platform',
      items: [
        { href: '/analytics',        label: 'Analytics',       icon: <BarChart3   size={15} /> },
        { href: '/audit-log',        label: 'Audit Log',       icon: <ScrollText  size={15} /> },
        { href: '/sla-monitor',      label: 'SLA Monitor',     icon: <Timer       size={15} /> },
        { href: '/agent-performance',label: 'Agent Performance',icon: <TrendingUp  size={15} /> },
        { href: '/staff',            label: 'Staff',           icon: <UserCog      size={15} /> },
        { href: '/staff-profiles',   label: 'Staff Profiles',  icon: <Users        size={15} /> },
        { href: '/attendance',       label: 'Attendance',      icon: <Clock        size={15} /> },
        { href: '/work-config',      label: 'Work Config',     icon: <CalendarClock size={15} /> },
        { href: '/config',           label: 'System Config',   icon: <Settings2    size={15} /> },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { href: '/database', label: 'Database', icon: <Database size={15} /> },
      ],
    },
    {
      label: 'Content & Compliance',
      items: [
        { href: '/compliance',     label: 'NDPR Compliance',  icon: <Shield      size={15} /> },
        { href: '/knowledge-base', label: 'Knowledge Base',   icon: <BookOpen    size={15} /> },
        { href: '/tutorials',      label: 'Tutorials',        icon: <PlayCircle  size={15} /> },
      ],
    },
  ]

  return (
    <aside
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
    >
      <SessionWatcher />
      {/* Logo */}
      <div
        style={{ borderColor: 'var(--border)' }}
        className="px-5 h-[60px] flex items-center gap-3 border-b flex-shrink-0"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
          flex items-center justify-center shadow-md flex-shrink-0">
          <Layers size={14} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[14px] font-bold font-display leading-none tracking-tight"
            style={{ color: 'var(--tx-1)' }}>
            Workstation
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] mt-1"
            style={{ color: 'var(--tx-3)' }}>
            Admin Panel
          </p>
        </div>
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
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
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`group flex items-center justify-between px-3 py-[7px] rounded-lg
                        text-[13px] font-medium transition-all duration-150
                        ${isActive ? 'border-l-2 border-indigo-500 pl-[10px]' : 'border-l-2 border-transparent pl-[10px]'}`}
                      style={{
                        backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : undefined,
                        color: isActive ? '#818CF8' : 'var(--tx-2)',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = ''
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-2)'
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span style={{ color: isActive ? '#818CF8' : 'var(--tx-3)' }}>
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

      {/* Clock widget — only for staff, never for admins */}
      {role !== 'superadmin' && role !== 'admin' && <ClockWidget />}

      {/* User dock */}
      <div
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        className="px-4 py-3.5 border-t flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-[11px] font-bold tracking-tight">
              {initials(name || 'Yvonne Harry')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-none truncate" style={{ color: 'var(--tx-1)' }}>
              {name || 'Yvonne Harry'}
            </p>
            <p className="text-[11px] font-medium leading-none mt-1 text-indigo-400">
              {role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Staff'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="w-7 h-7 rounded-lg flex items-center justify-center
                transition-all duration-150 flex-shrink-0"
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
                ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
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
