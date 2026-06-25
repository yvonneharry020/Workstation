'use client'
import Link from 'next/link'

export default function DeptSwitcher() {
  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-surface-border bg-surface-card/50 flex-wrap">
      <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider mr-1">Switch room:</span>
      <Link href="/tech/dashboard" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-900/20 border border-blue-800/30 text-xs font-semibold text-blue-400 hover:bg-blue-900/40 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-tech-500" />
        Technical
      </Link>
      <Link href="/finance/dashboard" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/40 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-finance-500" />
        Finance
      </Link>
      <Link href="/ops/dashboard" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-900/20 border border-orange-800/30 text-xs font-semibold text-orange-400 hover:bg-orange-900/40 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-ops-500" />
        Management
      </Link>
    </div>
  )
}
