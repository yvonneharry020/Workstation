'use client'

import TopBar from '@/components/layout/TopBar'
import { MOCK_STATS, MOCK_REGISTRATION_TREND } from '@/lib/mock-data'
import Link from 'next/link'

interface StatCardProps {
  label: string
  value: number
  sub?: string
  urgency?: 'none' | 'low' | 'mid' | 'high'
  href?: string
}

function UrgencyDot({ urgency }: { urgency: 'none' | 'low' | 'mid' | 'high' }) {
  const colors = {
    none: 'bg-trust-high',
    low: 'bg-trust-high',
    mid: 'bg-trust-mid',
    high: 'bg-error',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[urgency]} inline-block flex-shrink-0`} />
}

function StatCard({ label, value, sub, urgency = 'none', href }: StatCardProps) {
  const borderColor = {
    none: 'border-surface-border',
    low: 'border-trust-high-border',
    mid: 'border-trust-mid-border',
    high: 'border-trust-low-border',
  }[urgency]

  const inner = (
    <div className={`bg-surface-card rounded-xl border ${borderColor} p-5 flex flex-col gap-3 transition-colors hover:border-admin-500/40`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
        {urgency !== 'none' && <UrgencyDot urgency={urgency} />}
      </div>
      <p className="text-3xl font-bold font-mono text-text-primary">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )

  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function getUrgency(count: number): 'none' | 'low' | 'mid' | 'high' {
  if (count === 0) return 'none'
  if (count <= 5) return 'low'
  if (count <= 20) return 'mid'
  return 'high'
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120
  const h = 36
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrendBar({ items, maxVal, color }: { items: typeof MOCK_REGISTRATION_TREND; maxVal: number; color: 'admin' | 'teal' }) {
  const fillColor = color === 'admin' ? '#A855F7' : '#0DD4C3'
  const bgColor = color === 'admin' ? 'rgba(168,85,247,0.12)' : 'rgba(13,212,195,0.12)'

  return (
    <div className="flex items-end gap-1 h-16">
      {items.map((item) => {
        const val = color === 'admin' ? item.candidates : item.companies
        const pct = (val / maxVal) * 100
        return (
          <div key={item.date} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${item.date}: ${val}`}>
            <div className="w-full rounded-sm overflow-hidden" style={{ height: '48px' }}>
              <div
                className="w-full rounded-sm transition-all"
                style={{ height: `${pct}%`, marginTop: `${100 - pct}%`, backgroundColor: fillColor, opacity: 0.8 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const pendingTotal = MOCK_STATS.pendingCandidates + MOCK_STATS.pendingCompanies
  const candidateTrend = MOCK_REGISTRATION_TREND.map((r) => r.candidates)
  const maxCandidates = Math.max(...candidateTrend)
  const companyTrend = MOCK_REGISTRATION_TREND.map((r) => r.companies)
  const maxCompanies = Math.max(...companyTrend)

  return (
    <div className="flex flex-col">
      <TopBar
        title="Admin Dashboard"
        subtitle="Platform overview — real-time queue status and health"
      />

      <div className="px-8 py-8 space-y-8">
        {/* Primary stats */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Platform Health</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Verification Queue"
              value={pendingTotal}
              sub={`${MOCK_STATS.pendingCandidates} candidates · ${MOCK_STATS.pendingCompanies} companies`}
              urgency={getUrgency(pendingTotal)}
              href="/verifications/candidates"
            />
            <StatCard
              label="Flagged Items"
              value={MOCK_STATS.flaggedItems}
              sub="Requires immediate review"
              urgency={getUrgency(MOCK_STATS.flaggedItems)}
              href="/flagged"
            />
            <StatCard
              label="Active Job Listings"
              value={MOCK_STATS.activeJobListings}
              sub={`${MOCK_STATS.applicationsToday} applications today`}
              urgency="none"
            />
            <StatCard
              label="Verifications Today"
              value={MOCK_STATS.verificationsToday}
              sub="Processed in last 24h"
              urgency="none"
            />
          </div>
        </section>

        {/* User totals */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">User Base</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Candidates" value={MOCK_STATS.totalCandidates} sub="All-time registrations" />
            <StatCard label="Total Companies" value={MOCK_STATS.totalCompanies} sub="Active employers" />
            <StatCard label="Applications Today" value={MOCK_STATS.applicationsToday} sub="Submitted in last 24h" />
            <StatCard label="Pending Candidates" value={MOCK_STATS.pendingCandidates} sub="Awaiting verification" urgency={getUrgency(MOCK_STATS.pendingCandidates)} href="/verifications/candidates" />
          </div>
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Candidate registrations */}
          <div className="bg-surface-card rounded-xl border border-surface-border p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Candidate Registrations</h3>
                <p className="text-xs text-text-muted mt-1">Last 6 data points</p>
              </div>
              <Sparkline data={candidateTrend} color="#A855F7" />
            </div>
            <TrendBar items={MOCK_REGISTRATION_TREND} maxVal={maxCandidates} color="admin" />
            <div className="flex justify-between mt-2">
              {MOCK_REGISTRATION_TREND.map((r) => (
                <span key={r.date} className="text-[10px] text-text-muted font-mono">{r.date.split(' ')[0]}</span>
              ))}
            </div>
          </div>

          {/* Company registrations */}
          <div className="bg-surface-card rounded-xl border border-surface-border p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Company Registrations</h3>
                <p className="text-xs text-text-muted mt-1">Last 6 data points</p>
              </div>
              <Sparkline data={companyTrend} color="#0DD4C3" />
            </div>
            <TrendBar items={MOCK_REGISTRATION_TREND} maxVal={maxCompanies} color="teal" />
            <div className="flex justify-between mt-2">
              {MOCK_REGISTRATION_TREND.map((r) => (
                <span key={r.date} className="text-[10px] text-text-muted font-mono">{r.date.split(' ')[0]}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { href: '/verifications/candidates', label: 'Review Candidates', count: MOCK_STATS.pendingCandidates, color: 'admin' },
              { href: '/verifications/companies', label: 'Review Companies', count: MOCK_STATS.pendingCompanies, color: 'admin' },
              { href: '/flagged', label: 'Clear Flagged', count: MOCK_STATS.flaggedItems, color: 'error' },
              { href: '/disputes', label: 'Badge Disputes', count: 2, color: 'warning' },
              { href: '/tickets', label: 'Open Tickets', count: 2, color: 'teal' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="bg-surface-elevated hover:bg-surface-muted border border-surface-border hover:border-admin-500/40 rounded-xl p-4 flex flex-col gap-2 transition-colors"
              >
                <span className={`text-2xl font-mono font-bold ${
                  action.color === 'error' ? 'text-error' :
                  action.color === 'warning' ? 'text-warning' :
                  action.color === 'teal' ? 'text-teal-500' :
                  'text-admin-400'
                }`}>
                  {action.count}
                </span>
                <span className="text-xs text-text-secondary leading-snug">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
