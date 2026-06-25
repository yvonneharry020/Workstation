'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sub {
  id: string
  user_name: string
  user_email: string
  plan_name: string
  amount: number
  currency: string
  status: string
  cancelled_at: string | null
  cancel_reason: string | null
  paystack_subscription_code: string | null
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RefundsPage() {
  const supabase = createClient()
  const [cancelled, setCancelled] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [refundMsg, setRefundMsg] = useState<Record<string, string>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_subscriptions').select('*').in('status', ['cancelled', 'past_due']).order('cancelled_at', { ascending: false })
    setCancelled((data ?? []) as Sub[])
    setLoading(false)
  }

  function initiateRefund(sub: Sub) {
    setRefundMsg(prev => ({ ...prev, [sub.id]: `Refund initiated for ${fmt(sub.amount)}. Process manually in Paystack dashboard with code: ${sub.paystack_subscription_code ?? 'N/A'}` }))
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Refunds</h1>
        <p className="text-sm text-text-secondary mt-0.5">Cancelled and past-due subscriptions eligible for refund review. Live refunds processed via Paystack dashboard (test mode active).</p>
      </div>

      <div className="px-8 py-6 max-w-4xl">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : cancelled.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">No cancelled subscriptions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cancelled.map(sub => (
              <div key={sub.id} className="bg-surface-card border border-surface-border rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{sub.user_name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${sub.status === 'past_due' ? 'bg-orange-900/20 text-orange-400 border-orange-800/30' : 'bg-red-900/20 text-red-400 border-red-800/30'}`}>{sub.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{sub.user_email}</p>
                    <p className="text-xs text-text-muted mt-1">{sub.plan_name} · Cancelled: {formatDate(sub.cancelled_at)}</p>
                    {sub.cancel_reason && <p className="text-xs text-text-muted mt-0.5">Reason: {sub.cancel_reason}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-text-primary font-display">{fmt(sub.amount)}</p>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">{sub.paystack_subscription_code ?? 'No code'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {refundMsg[sub.id] ? (
                    <div className="flex-1 mr-4 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-yellow-300">{refundMsg[sub.id]}</p>
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {!refundMsg[sub.id] && (
                    <button onClick={() => initiateRefund(sub)} className="px-4 py-2 bg-orange-900/20 border border-orange-800/30 text-orange-400 text-xs font-semibold rounded-xl hover:bg-orange-900/30 transition-colors">
                      Initiate Refund
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
