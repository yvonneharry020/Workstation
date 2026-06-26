'use client'

import Link from 'next/link'
import { Code2, DollarSign, Users2, Search, Bell } from 'lucide-react'

export default function DeptSwitcher() {
  return (
    <header
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      className="h-12 flex items-center justify-between px-5 border-b sticky top-0 z-20 flex-shrink-0"
    >
      {/* Room switcher links */}
      <div className="flex items-center gap-0.5">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.12em] mr-3"
          style={{ color: 'var(--tx-3)' }}
        >
          Rooms
        </span>
        <Link
          href="/tech/dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]
            font-semibold text-cyan-400 hover:bg-cyan-500/10 transition-all duration-150"
        >
          <Code2 size={11} />
          Technical
        </Link>
        <Link
          href="/finance/dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]
            font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-all duration-150"
        >
          <DollarSign size={11} />
          Finance
        </Link>
        <Link
          href="/ops/dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]
            font-semibold text-amber-400 hover:bg-amber-500/10 transition-all duration-150"
        >
          <Users2 size={11} />
          Management
        </Link>
      </div>

      {/* Utility icons */}
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
