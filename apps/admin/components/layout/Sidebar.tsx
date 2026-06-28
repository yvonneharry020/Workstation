'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShieldCheck, Building2, Flag, Briefcase,
  Users, Award, Bell, TicketCheck, Inbox, MessageSquare,
  BarChart3, ScrollText, UserCog, Settings2, Sun, Moon,
  Layers, Shield, BookOpen, PlayCircle,
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

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

interface SidebarProps {
  pendingCandidates?: number
  pendingCompanies?: number
  flaggedItems?: number
  badgeDisputes?: number
  adminInboxCount?: number
}

export default function Sidebar({
  pendingCandidates = 0,
  pendingCompanies = 0,
  flaggedItems = 0,
  badgeDisputes = 0,
  adminInboxCount = 0,
}: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
      ],
    },
    {
      label: 'Verification',
      items: [
        { href: '/verifications/candidates', label: 'Candidate Queue', icon: <ShieldCheck size={15} />, badge: pendingCandidates },
        { href: '/verifications/companies',  label: 'Company Queue',   icon: <Building2   size={15} />, badge: pendingCompanies },
      ],
    },
    {
      label: 'Moderation',
      items: [
        { href: '/flagged', label: 'Flagged Content', icon: <Flag      size={15} />, badge: flaggedItems },
        { href: '/jobs',    label: 'Job Moderation',  icon: <Briefcase size={15} /> },
      ],
    },
    {
      label: 'Management',
      items: [
        { href: '/users',         label: 'User Management', icon: <Users    size={15} /> },
        { href: '/disputes',      label: 'Badge Disputes',  icon: <Award    size={15} />, badge: badgeDisputes },
        { href: '/notifications', label: 'Notifications',   icon: <Bell     size={15} /> },
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
        { href: '/analytics', label: 'Analytics',    icon: <BarChart3   size={15} /> },
        { href: '/audit-log', label: 'Audit Log',    icon: <ScrollText  size={15} /> },
        { href: '/staff',     label: 'Staff',        icon: <UserCog     size={15} /> },
        { href: '/config',    label: 'System Config', icon: <Settings2  size={15} /> },
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
                  <li key={item.href}>
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

      {/* User dock */}
      <div
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        className="px-4 py-3.5 border-t flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-[11px] font-bold tracking-tight">YH</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-none truncate" style={{ color: 'var(--tx-1)' }}>
              Yvonne Harry
            </p>
            <p className="text-[11px] font-medium leading-none mt-1 text-indigo-400">
              Super Admin
            </p>
          </div>
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
        </div>
      </div>
    </aside>
  )
}
