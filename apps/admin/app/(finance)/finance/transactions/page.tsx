'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface Transaction {
  id: string
  user_name: string
  user_email: string
  user_type: string
  plan_name: string
  amount: number
  currency: string
  status: string
  started_at: string
  paystack_subscription_code: string | null
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase
      .from('platform_subscriptions')
      .select('id,user_name,user_email,user_type,plan_name,amount,currency,status,started_at,paystack_subscription_code')
      .order('started_at', { ascending: false })
    setTransactions((data ?? []) as Transaction[])
    setLoading(false)
  }

  const filtered = transactions.filter(t => {
    const d = new Date(t.started_at)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
    if (search && !t.user_name.toLowerCase().includes(search.toLowerCase()) && !t.user_email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = filtered.reduce((sum, t) => sum + t.amount, 0)

  function exportCSV() {
    const header = 'Date,Customer,Email,Type,Plan,Amount,Status,Paystack Code'
    const rows = filtered.map(t => `${formatDate(t.started_at)},"${t.user_name}",${t.user_email},${t.user_type},${t.plan_name},${t.amount},${t.status},${t.paystack_subscription_code ?? ''}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Transactions</h1>
          <p className="text-sm text-text-secondary mt-0.5">Full subscription ledger. Total filtered: <span className="text-finance-400 font-semibold">{fmt(total)}</span></p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-finance-500/10 border border-finance-800/30 text-finance-400 text-sm font-semibold rounded-xl hover:bg-finance-500/20 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer…" className="w-48 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-finance-500" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
        <span className="text-text-muted text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
        {(dateFrom || dateTo || search) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setSearch('') }} className="text-xs text-text-muted hover:text-text-primary transition-colors">Clear filters</button>
        )}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} records</span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  {['Date','Customer','Plan','Amount','Status','Paystack Ref'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3 text-text-muted text-xs font-mono">{formatDate(t.started_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{t.user_name}</p>
                      <p className="text-xs text-text-muted">{t.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{t.plan_name}</td>
                    <td className="px-4 py-3 font-semibold text-finance-400">{fmt(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${t.status === 'active' ? 'bg-green-900/20 text-green-400 border-green-800/30' : 'bg-gray-900/20 text-gray-400 border-gray-800/30'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs font-mono">{t.paystack_subscription_code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
