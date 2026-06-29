'use client'

import Link from 'next/link'
import { Code2, DollarSign, Users2, Search, Bell } from 'lucide-react'
import { useStaffInfo } from '@/lib/staff-cookies'

const ROOM_LINKS = [
  { key: 'technical',  href: '/tech/dashboard',   label: 'Technical',  icon: <Code2 size={11} />,      cls: 'text-cyan-400 hover:bg-cyan-500/10'      },
  { key: 'finance',    href: '/finance/dashboard', label: 'Finance',    icon: <DollarSign size={11} />, cls: 'text-emerald-400 hover:bg-emerald-500/10' },
  { key: 'management', href: '/ops/dashboard',     label: 'Management', icon: <Users2 size={11} />,     cls: 'text-amber-400 hover:bg-amber-500/10'    },
]

export default function DeptSwitcher() {
  const { role, permissions } = useStaffInfo()

  const isAdminOrSuper = role === 'admin' || role === 'superadmin'
  const visibleRooms = ROOM_LINKS.filter(r =>
    isAdminOrSuper || permissions[r.key as keyof typeof permissions]
  )

  return (
    <header
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      className="h-12 flex items-center justify-between px-5 border-b sticky top-0 z-20 flex-shrink-0"
    >
      <div className="flex items-center gap-0.5">
        {visibleRooms.length > 0 && (
          <span
            className="text-[10px] font-mono uppercase tracking-[0.12em] mr-3"
            style={{ color: 'var(--tx-3)' }}
          >
            Rooms
          </span>
        )}
        {visibleRooms.map(r => (
          <Link
            key={r.key}
            href={r.href}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]
              font-semibold transition-all duration-150 ${r.cls}`}
          >
            {r.icon}
            {r.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ color: 'var(--tx-3)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
            ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'
          }}
        >
          <Search size={14} />
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ color: 'var(--tx-3)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-1)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
            ;(e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'
          }}
        >
          <Bell size={14} />
        </button>
      </div>
    </header>
  )
}
