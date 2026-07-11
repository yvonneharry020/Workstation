'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface Sub {
  id: string
  user_name: string
  user_email: string
  user_type: string
  plan_name: string
  plan_code: string
  amount: number
  currency: string
  status: string
  paystack_subscription_code: string | null
  started_at: string
  next_payment_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900/20 text-green-400 border-green-800/30',
  cancelled: 'bg-red-900/20 text-red-400 border-red-800/30',
  past_due: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  trialing: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  expired: 'bg-gray-900/20 text-gray-400 border-gray-800/30',
}

const USER_TYPE_COLORS: Record<string, string> = {
  candidate: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  company: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SubscriptionsPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState<Sub | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_subscriptions').select('*').order('started_at', { ascending: false })
    setSubs((data ?? []) as Sub[])
    setLoading(false)
  }

  async function cancelSub(sub: Sub) {
    setCancelling(true)
    const { error } = await supabase.from('platform_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'Cancelled by admin' })
      .eq('id', sub.id)
    if (!error) {
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'cancelled', cancelled_at: new Date().toISOString() } : s))
      setSelected(prev => prev?.id === sub.id ? { ...prev, status: 'cancelled' } : prev)
    }
    setCancelling(false)
  }

  const filtered = subs.filter(s =>
    (statusFilter === 'all' || s.status === statusFilter) &&
    (typeFilter === 'all' || s.user_type === typeFilter)
  )

  const mrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Subscriptions</h1>
          <p className="text-sm text-text-secondary mt-0.5">All platform subscriptions. MRR: <span className="text-finance-400 font-semibold">₦{mrr.toLocaleString('en-NG')}</span></p>
        </div>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {['all','active','cancelled','past_due','trialing','expired'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-finance-900/50 text-finance-300 border border-finance-800/30' : 'text-text-secondary hover:text-text-primary'}`}>{s.replace('_',' ')}</button>
          ))}
        </div>
        <div className="flex gap-1 ml-4">
          {['all','candidate','company'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${typeFilter === t ? 'bg-surface-elevated text-text-primary border border-surface-border' : 'text-text-secondary hover:text-text-primary'}`}>{t}</button>
          ))}
        </div>
        <span className="text-xs text-text-muted ml-auto">{filtered.length} records</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {loading ? (
            <div className="text-text-muted text-sm">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-elevated border-b border-surface-border">
                    {['Customer','Plan','Amount','Status','Type','Started','Next Payment'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filtered.map(s => (
                    <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-surface-elevated/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">{s.user_name}</p>
                        <p className="text-xs text-text-muted">{s.user_email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{s.plan_name}</td>
                      <td className="px-4 py-3 font-semibold text-finance-400">{fmt(s.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[s.status] ?? ''}`}>{s.status.replace('_',' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${USER_TYPE_COLORS[s.user_type] ?? ''}`}>{s.user_type}</span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{formatDate(s.started_at)}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">{formatDate(s.next_payment_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="w-72 flex-shrink-0 border-l border-surface-border overflow-y-auto">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Details</p>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Customer', value: selected.user_name },
                { label: 'Email', value: selected.user_email },
                { label: 'Plan', value: selected.plan_name },
                { label: 'Amount', value: fmt(selected.amount) },
                { label: 'Status', value: selected.status.replace('_',' ') },
                { label: 'User Type', value: selected.user_type },
                { label: 'Started', value: formatDate(selected.started_at) },
                { label: 'Next Payment', value: formatDate(selected.next_payment_at) },
                { label: 'Paystack Code', value: selected.paystack_subscription_code ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-text-primary mt-0.5">{value}</p>
                </div>
              ))}
              {selected.status === 'active' && (
                <div className="pt-3 border-t border-surface-border">
                  <button onClick={() => void cancelSub(selected)} disabled={cancelling}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-red-900/20 text-red-400 border border-red-800/30 hover:bg-red-900/30 transition-colors disabled:opacity-40">
                    {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
                  </button>
                  <p className="text-[10px] text-text-muted mt-1.5 text-center">Will also need to cancel in Paystack dashboard when live.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
