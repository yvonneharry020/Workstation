'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Sub {
  id: string
  user_name: string
  user_email: string
  user_type: string
  plan_name: string
  amount: number
  currency: string
  status: string
  started_at: string
  next_payment_at: string | null
}

interface Cost {
  amount: number
  currency: string
  month: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900/20 text-green-400 border-green-800/30',
  cancelled: 'bg-red-900/20 text-red-400 border-red-800/30',
  past_due: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  trialing: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  expired: 'bg-gray-900/20 text-gray-400 border-gray-800/30',
}

function fmt(amount: number, currency = 'NGN') {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return `₦${amount.toLocaleString('en-NG')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FinanceDashboardPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Sub[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
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

  const activeSubs = subs.filter(s => s.status === 'active')
  const mrr = activeSubs.reduce((sum, s) => sum + s.amount, 0)
  const totalCostsThisMonth = costs.filter(c => c.month === '2026-06').reduce((sum, c) => sum + c.amount, 0)
  const mrrUSD = mrr / 1600
  const netMarginUSD = mrrUSD - totalCostsThisMonth
  const pastDue = subs.filter(s => s.status === 'past_due').length

  const byPlan = activeSubs.reduce<Record<string, number>>((acc, s) => {
    acc[s.plan_name] = (acc[s.plan_name] ?? 0) + 1
    return acc
  }, {})

  const recentSubs = subs.slice(0, 5)

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Finance Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">Revenue, costs, and subscription health — all in one place.</p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-6xl">
        {loading ? <div className="text-text-muted text-sm">Loading…</div> : (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Link href="/finance/subscriptions" className="bg-surface-card border border-finance-800/30 rounded-xl p-5 hover:border-finance-500/40 transition-colors">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">MRR (NGN)</p>
                <div className="text-2xl font-bold text-finance-400 font-display">{fmt(mrr)}</div>
                <p className="text-xs text-text-muted mt-1">{activeSubs.length} active subscriptions</p>
              </Link>
              <Link href="/finance/costs" className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-finance-500/40 transition-colors">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Platform Costs (USD)</p>
                <div className="text-2xl font-bold text-text-primary font-display">${totalCostsThisMonth.toFixed(2)}</div>
                <p className="text-xs text-text-muted mt-1">June 2026</p>
              </Link>
              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Net Margin (USD est.)</p>
                <div className={`text-2xl font-bold font-display ${netMarginUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>${netMarginUSD.toFixed(2)}</div>
                <p className="text-xs text-text-muted mt-1">After infra costs</p>
              </div>
              <Link href="/finance/subscriptions" className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-orange-500/40 transition-colors">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Past Due</p>
                <div className={`text-2xl font-bold font-display ${pastDue > 0 ? 'text-orange-400' : 'text-text-primary'}`}>{pastDue}</div>
                <p className="text-xs text-text-muted mt-1">Need attention</p>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <p className="text-sm font-semibold text-text-primary mb-4">Subscriptions by Plan</p>
                <div className="space-y-3">
                  {Object.entries(byPlan).map(([plan, count]) => {
                    const planMrr = activeSubs.filter(s => s.plan_name === plan).reduce((sum, s) => sum + s.amount, 0)
                    const pct = mrr > 0 ? Math.round((planMrr / mrr) * 100) : 0
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-text-primary">{plan}</span>
                          <span className="text-xs text-text-muted">{count} · {fmt(planMrr)} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                          <div className="h-full bg-finance-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-text-primary">Recent Subscriptions</p>
                  <Link href="/finance/subscriptions" className="text-xs text-finance-400 hover:text-finance-300">View all →</Link>
                </div>
                <ul className="space-y-2.5">
                  {recentSubs.map(s => (
                    <li key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-finance-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-finance-400 text-[10px] font-bold">{s.user_name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{s.user_name}</p>
                          <p className="text-[10px] text-text-muted truncate">{s.plan_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-finance-400">{fmt(s.amount)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[s.status] ?? ''}`}>{s.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Transactions', href: '/finance/transactions', desc: 'Full payment ledger', icon: '💳' },
                { label: 'Invoices', href: '/finance/invoices', desc: 'Download & manage invoices', icon: '📄' },
                { label: 'P&L Report', href: '/finance/reports', desc: 'Export financial summary', icon: '📊' },
              ].map(qa => (
                <Link key={qa.href} href={qa.href} className="flex items-center gap-3 px-4 py-3.5 bg-surface-card border border-surface-border rounded-xl hover:border-finance-800/30 transition-colors group">
                  <span className="text-xl">{qa.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary group-hover:text-finance-300 transition-colors">{qa.label}</p>
                    <p className="text-xs text-text-muted">{qa.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
