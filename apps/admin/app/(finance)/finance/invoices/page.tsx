'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  paystack_subscription_code: string | null
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function generateInvoiceId(subId: string, date: string) {
  return `INV-${new Date(date).getFullYear()}-${subId.slice(0, 6).toUpperCase()}`
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_subscriptions').select('*').order('started_at', { ascending: false })
    setSubs((data ?? []) as Sub[])
    setLoading(false)
  }

  function downloadInvoice(sub: Sub) {
    setDownloading(sub.id)
    const invoiceId = generateInvoiceId(sub.id, sub.started_at)
    const content = [
      `WORKSTATION PLATFORM`,
      `Invoice #${invoiceId}`,
      `Date: ${formatDate(sub.started_at)}`,
      ``,
      `Bill To:`,
      `  ${sub.user_name}`,
      `  ${sub.user_email}`,
      `  User Type: ${sub.user_type}`,
      ``,
      `Description                             Amount`,
      `-----------------------------------------------`,
      `${sub.plan_name} - Monthly Subscription   ${fmt(sub.amount)}`,
      ``,
      `-----------------------------------------------`,
      `TOTAL                                   ${fmt(sub.amount)}`,
      ``,
      `Payment Reference: ${sub.paystack_subscription_code ?? 'N/A'}`,
      `Status: ${sub.status}`,
      ``,
      `Thank you for using Workstation Platform.`,
      `For support: support@workstation.ng`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceId}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setDownloading(null), 1500)
  }

  const filtered = subs.filter(s =>
    search === '' || s.user_name.toLowerCase().includes(search.toLowerCase()) || s.user_email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Invoices</h1>
          <p className="text-sm text-text-secondary mt-0.5">Download invoices for all subscription transactions.</p>
        </div>
      </div>

      <div className="px-8 py-3 border-b border-surface-border">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer…" className="w-72 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-finance-500" />
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  {['Invoice #', 'Customer', 'Plan', 'Amount', 'Date', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">{generateInvoiceId(sub.id, sub.started_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{sub.user_name}</p>
                      <p className="text-xs text-text-muted">{sub.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{sub.plan_name}</td>
                    <td className="px-4 py-3 font-semibold text-finance-400">{fmt(sub.amount)}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{formatDate(sub.started_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${sub.status === 'active' ? 'bg-green-900/20 text-green-400 border-green-800/30' : 'bg-gray-900/20 text-gray-400 border-gray-800/30'}`}>{sub.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => downloadInvoice(sub)} disabled={downloading === sub.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-finance-500/10 border border-finance-800/30 text-finance-400 text-xs font-semibold rounded-lg hover:bg-finance-500/20 transition-colors disabled:opacity-40">
                        {downloading === sub.id ? '…' : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                          </>
                        )}
                      </button>
                    </td>
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
