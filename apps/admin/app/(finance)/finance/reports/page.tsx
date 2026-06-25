'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sub {
  plan_name: string
  amount: number
  status: string
  started_at: string
  cancelled_at: string | null
}

interface Cost {
  month: string
  category: string
  vendor: string
  amount: number
  currency: string
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }
function fmtUSD(amount: number) { return `$${amount.toFixed(2)}` }

const MONTHS = ['2026-05', '2026-06']
const RATE = 1600

export default function ReportsPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Sub[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('2026-06')

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: subData }, { data: costData }] = await Promise.all([
      supabase.from('platform_subscriptions').select('plan_name,amount,status,started_at,cancelled_at'),
      supabase.from('platform_costs').select('month,category,vendor,amount,currency'),
    ])
    setSubs((subData ?? []) as Sub[])
    setCosts((costData ?? []) as Cost[])
    setLoading(false)
  }

  const monthSubs = subs.filter(s => s.started_at.startsWith(selectedMonth))
  const newRevenue = monthSubs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0)
  const cancelledRevenue = subs.filter(s => s.cancelled_at?.startsWith(selectedMonth)).reduce((sum, s) => sum + s.amount, 0)
  const activeMrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0)
  const monthCosts = costs.filter(c => c.month === selectedMonth && c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0)
  const netMargin = (activeMrr / RATE) - monthCosts
  const netMarginPct = activeMrr > 0 ? Math.round((netMargin / (activeMrr / RATE)) * 100) : 0

  function exportCSV() {
    const header = 'Metric,Value'
    const rows = [
      `Month,${selectedMonth}`,
      `Active MRR (NGN),${activeMrr}`,
      `Active MRR (USD est.),${(activeMrr / RATE).toFixed(2)}`,
      `New Revenue This Month (NGN),${newRevenue}`,
      `Cancelled Revenue,${cancelledRevenue}`,
      `Platform Costs (USD),${monthCosts.toFixed(2)}`,
      `Net Margin (USD),${netMargin.toFixed(2)}`,
      `Net Margin %,${netMarginPct}%`,
    ]
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pnl-report-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const costByCategory = costs.filter(c => c.month === selectedMonth).reduce<Record<string, number>>((acc, c) => {
    const usd = c.currency === 'USD' ? c.amount : c.amount / RATE
    acc[c.category] = (acc[c.category] ?? 0) + usd
    return acc
  }, {})

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">P&L Reports</h1>
          <p className="text-sm text-text-secondary mt-0.5">Profit and loss summary by month. Export to CSV for accounting.</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-finance-500/10 border border-finance-800/30 text-finance-400 text-sm font-semibold rounded-xl hover:bg-finance-500/20 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      <div className="px-8 py-4 border-b border-surface-border flex items-center gap-2">
        {MONTHS.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedMonth === m ? 'bg-finance-900/50 text-finance-300 border border-finance-800/30' : 'text-text-secondary hover:text-text-primary'}`}>{m}</button>
        ))}
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-6">
        {loading ? <div className="text-text-muted text-sm">Loading…</div> : (
          <>
            <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-border bg-surface-elevated">
                <p className="text-sm font-semibold text-text-primary">P&L Summary — {selectedMonth}</p>
              </div>
              <div className="divide-y divide-surface-border">
                {[
                  { label: 'Active MRR', value: fmt(activeMrr), highlight: true },
                  { label: 'Active MRR (USD est.)', value: fmtUSD(activeMrr / RATE), highlight: false },
                  { label: 'New Revenue (this month)', value: fmt(newRevenue), highlight: false },
                  { label: 'Churn Revenue (cancelled)', value: `-${fmt(cancelledRevenue)}`, highlight: false, negative: true },
                  { label: 'Platform Costs (USD)', value: `-${fmtUSD(monthCosts)}`, highlight: false, negative: true },
                  { label: 'Net Margin (USD est.)', value: fmtUSD(netMargin), highlight: true, positive: netMargin >= 0 },
                  { label: 'Net Margin %', value: `${netMarginPct}%`, highlight: false },
                ].map(row => (
                  <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${row.highlight ? 'bg-finance-900/10' : ''}`}>
                    <span className="text-sm text-text-secondary">{row.label}</span>
                    <span className={`text-sm font-bold ${row.positive === false ? 'text-red-400' : row.positive === true ? 'text-green-400' : row.highlight ? 'text-finance-400' : 'text-text-primary'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(costByCategory).length > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border bg-surface-elevated">
                  <p className="text-sm font-semibold text-text-primary">Cost Breakdown — {selectedMonth}</p>
                </div>
                <div className="divide-y divide-surface-border">
                  {Object.entries(costByCategory).map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-text-secondary capitalize">{cat}</span>
                      <span className="text-sm font-semibold text-text-primary">{fmtUSD(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
