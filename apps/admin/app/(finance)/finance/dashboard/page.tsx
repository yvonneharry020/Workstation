'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, DollarSign, CreditCard, AlertCircle,
  ChevronRight, Activity, Receipt, FileText, BarChart3,
} from 'lucide-react'

interface Sub {
  id: string; user_name: string; plan_name: string
  amount: number; currency: string; status: string; started_at: string
}

interface Cost { amount: number; currency: string; month: string }

const STATUS_PILL: Record<string, { text: string; bg: string; border: string }> = {
  active:    { text: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
  cancelled: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
  past_due:  { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  trialing:  { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.3)' },
  expired:   { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
}

function fmt(amount: number, currency = 'NGN') {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return `₦${amount.toLocaleString('en-NG')}`
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-md)' }}
      className="rounded-xl px-3 py-2.5 text-[12px]">
      <p className="font-semibold mb-0.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
      <p className="font-bold text-[14px] text-emerald-400">{payload[0].value} subs</p>
    </div>
  )
}

interface KpiCardProps {
  label: string; value: string; sub: string
  icon: React.ReactNode; iconBg: string; iconColor: string
  accent?: string; href?: string; highlight?: boolean
}

function KpiCard({ label, value, sub, icon, iconBg, iconColor, accent, href, highlight }: KpiCardProps) {
  const inner = (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${highlight ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = accent ?? 'var(--border-strong)'
        el.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = highlight ? 'rgba(16,185,129,0.25)' : 'var(--border)'
        el.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div>
        <p className="text-[22px] font-bold font-display leading-none tracking-tight"
          style={{ color: 'var(--tx-1)' }}>
          {value}
        </p>
        <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{sub}</p>
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

export default function FinanceDashboardPage() {
  const supabase = createClient()
  const [subs, setSubs]     = useState<Sub[]>([])
  const [costs, setCosts]   = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: subData }, { data: costData }] = await Promise.all([
      supabase.from('platform_subscriptions').select('*').order('started_at', { ascending: false }),
      supabase.from('platform_costs').select('amount,currency,month').eq('currency', 'USD'),
    ])
    setSubs((subData ?? []) as Sub[])
    setCosts((costData ?? []) as Cost[])
    setLoading(false)
  }

  const thisMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const activeSubs = subs.filter(s => s.status === 'active')
  const mrr = activeSubs.reduce((sum, s) => sum + s.amount, 0)
  const totalCosts = costs.filter(c => c.month === thisMonth).reduce((sum, c) => sum + c.amount, 0)
  const mrrUSD = mrr / 1600
  const netMargin = mrrUSD - totalCosts
  const pastDue = subs.filter(s => s.status === 'past_due').length

  const byPlan = activeSubs.reduce<Record<string, { count: number; revenue: number }>>((acc, s) => {
    if (!acc[s.plan_name]) acc[s.plan_name] = { count: 0, revenue: 0 }
    acc[s.plan_name].count++
    acc[s.plan_name].revenue += s.amount
    return acc
  }, {})

  const planChartData = Object.entries(byPlan).map(([name, d]) => ({
    name, count: d.count, revenue: d.revenue,
  }))

  const PLAN_COLORS = ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#F43F5E']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
              Finance Dashboard
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              Revenue, costs, and subscription health — all in one place
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)' }}>
            <Activity size={12} />
            <span>Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6 flex-1">

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Monthly Revenue (NGN)"
            value={fmt(mrr)}
            sub={`${activeSubs.length} active subscriptions`}
            icon={<TrendingUp size={18} />}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#34D399"
            accent="rgba(16,185,129,0.4)"
            highlight
            href="/finance/subscriptions"
          />
          <KpiCard
            label="Platform Costs (USD)"
            value={`$${totalCosts.toFixed(2)}`}
            sub={`Infrastructure · ${new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`}
            icon={<DollarSign size={18} />}
            iconBg="rgba(6,182,212,0.12)"
            iconColor="#22D3EE"
            accent="rgba(6,182,212,0.4)"
            href="/finance/costs"
          />
          <KpiCard
            label="Net Margin (USD)"
            value={`${netMargin >= 0 ? '' : '-'}$${Math.abs(netMargin).toFixed(2)}`}
            sub="After infrastructure costs"
            icon={<BarChart3 size={18} />}
            iconBg={netMargin >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
            iconColor={netMargin >= 0 ? '#34D399' : '#F87171'}
            accent={netMargin >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}
          />
          <KpiCard
            label="Past Due"
            value={String(pastDue)}
            sub={pastDue > 0 ? 'Need immediate attention' : 'All payments current'}
            icon={<AlertCircle size={18} />}
            iconBg={pastDue > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'}
            iconColor={pastDue > 0 ? '#FBBF24' : '#34D399'}
            accent="rgba(245,158,11,0.4)"
            href="/finance/subscriptions"
          />
        </div>

        {/* Chart + Recent subs */}
        <div className="grid grid-cols-2 gap-5">
          {/* Plan distribution chart */}
          <div className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="mb-5">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Subscriptions by Plan</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>Active subscriber count per plan</p>
            </div>
            {planChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={planChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--tx-3)', fontFamily: 'var(--font-mono)' }}
                      tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                    <Bar dataKey="count" name="subscribers" radius={[6, 6, 0, 0]}>
                      {planChartData.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Plan legend + revenue bars */}
                <div className="mt-4 space-y-2.5">
                  {Object.entries(byPlan).map(([plan, d], i) => {
                    const pct = mrr > 0 ? Math.round((d.revenue / mrr) * 100) : 0
                    const color = PLAN_COLORS[i % PLAN_COLORS.length]
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium" style={{ color: 'var(--tx-1)' }}>{plan}</span>
                          <span className="text-[11px] font-mono" style={{ color: 'var(--tx-3)' }}>
                            {d.count} · {fmt(d.revenue)} · {pct}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--tx-3)' }}>
                No active subscriptions yet.
              </p>
            )}
          </div>

          {/* Recent subscriptions */}
          <div className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Recent Subscriptions</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>Latest billing activity</p>
              </div>
              <Link href="/finance/subscriptions" className="text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <ul className="space-y-3">
              {subs.slice(0, 6).map(s => {
                const pill = STATUS_PILL[s.status] ?? STATUS_PILL.expired
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600
                        flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[11px] font-bold">{s.user_name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--tx-1)' }}>
                          {s.user_name}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--tx-3)' }}>{s.plan_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[13px] font-semibold text-emerald-400">{fmt(s.amount)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg border capitalize"
                        style={{ color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                  </li>
                )
              })}
              {subs.length === 0 && (
                <p className="text-[13px] py-6 text-center" style={{ color: 'var(--tx-3)' }}>No subscriptions yet.</p>
              )}
            </ul>
          </div>
        </div>

        {/* Quick links row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Transactions',  href: '/finance/transactions', desc: 'Full payment ledger',      Icon: CreditCard },
            { label: 'Invoices',      href: '/finance/invoices',     desc: 'Download & manage invoices', Icon: FileText },
            { label: 'P&L Report',    href: '/finance/reports',      desc: 'Export financial summary',  Icon: Receipt },
          ].map(qa => (
            <Link
              key={qa.href}
              href={qa.href}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-transparent
                transition-all duration-150 group"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(16,185,129,0.4)'
                el.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.boxShadow = 'var(--shadow-card)'
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <qa.Icon size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>{qa.label}</p>
                <p className="text-[12px]" style={{ color: 'var(--tx-3)' }}>{qa.desc}</p>
              </div>
              <ChevronRight size={14} className="ml-auto text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
