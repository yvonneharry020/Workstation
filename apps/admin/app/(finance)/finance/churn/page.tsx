'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface Sub {
  id: string
  user_id: string | null
  user_name: string
  plan_name: string
  amount: number
  currency: string
  status: string
  started_at: string
  cancelled_at: string | null
  expires_at: string | null
  created_at: string
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysBetween(a: string, b: string | null) {
  if (!b) return 0
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type DateRange = '30d' | '90d' | '6m' | 'all'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '30d': 'Last 30 Days', '90d': 'Last 90 Days', '6m': 'Last 6 Months', 'all': 'All Time',
}

export default function ChurnPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('platform_subscriptions')
      .select('id,user_id,user_name,plan_name,amount,currency,status,started_at,cancelled_at,expires_at,created_at')
      .order('created_at', { ascending: false })
    setSubs((data ?? []) as Sub[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function getCutoff(r: DateRange): Date | null {
    const now = new Date()
    if (r === '30d') return new Date(now.getTime() - 30 * 86_400_000)
    if (r === '90d') return new Date(now.getTime() - 90 * 86_400_000)
    if (r === '6m')  return new Date(now.getTime() - 180 * 86_400_000)
    return null
  }

  const cutoff = getCutoff(range)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const cancelled = subs.filter(s => s.status === 'cancelled' && s.cancelled_at && (!cutoff || new Date(s.cancelled_at) >= cutoff))
  const active = subs.filter(s => s.status === 'active')
  const expired = subs.filter(s => s.status === 'expired')
  const cancelledThisMonth = subs.filter(s => s.status === 'cancelled' && s.cancelled_at && s.cancelled_at.startsWith(currentMonth))

  const total = subs.filter(s => s.status !== 'expired').length
  const churnRate = total > 0 ? (cancelled.length / total) * 100 : 0
  const retentionRate = 100 - churnRate
  const mrrLoss = cancelledThisMonth.reduce((s, sub) => s + sub.amount, 0)

  const retentionColor = retentionRate > 80 ? '#22C55E' : retentionRate > 60 ? '#FBBF24' : '#EF4444'

  // Churn by plan
  const planNames = [...new Set(subs.map(s => s.plan_name))]
  const planStats = planNames.map(plan => {
    const planSubs = subs.filter(s => s.plan_name === plan && s.status !== 'expired')
    const planActive = planSubs.filter(s => s.status === 'active').length
    const planCancelled = planSubs.filter(s => s.status === 'cancelled' && (!cutoff || (s.cancelled_at && new Date(s.cancelled_at) >= cutoff))).length
    const planTotal = planActive + planCancelled
    return { plan, active: planActive, cancelled: planCancelled, rate: planTotal > 0 ? (planCancelled / planTotal) * 100 : 0 }
  }).sort((a, b) => b.rate - a.rate)

  // Last 20 cancelled
  const recentCancelled = [...subs]
    .filter(s => s.status === 'cancelled' && s.cancelled_at)
    .sort((a, b) => new Date(b.cancelled_at!).getTime() - new Date(a.cancelled_at!).getTime())
    .slice(0, 20)

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Churn Analysis" subtitle="Subscription retention and cancellation metrics" />

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Date Range Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                backgroundColor: range === r ? 'rgba(16,185,129,0.15)' : 'transparent',
                borderColor: range === r ? '#10B981' : 'var(--border)',
                color: range === r ? '#10B981' : 'var(--tx-2)',
              }}>
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Retention Hero + Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ ...CARD_STYLE, padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Retention Rate</p>
            <p style={{ fontSize: '52px', fontWeight: 800, color: retentionColor, lineHeight: 1 }}>{retentionRate.toFixed(1)}%</p>
            <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '8px' }}>Churn: {churnRate.toFixed(1)}%</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Current Churn Rate', value: `${churnRate.toFixed(1)}%`, color: churnRate < 5 ? '#22C55E' : churnRate < 15 ? '#FBBF24' : '#EF4444' },
              { label: 'Cancelled This Month', value: cancelledThisMonth.length, color: '#EF4444' },
              { label: 'Active Subscriptions', value: active.length, color: '#22C55E' },
              { label: 'MRR Lost This Month', value: formatNGN(mrrLoss), color: '#F97316' },
              { label: 'Total Cancelled', value: cancelled.length, color: '#9CA3AF' },
              { label: 'Total Subscriptions', value: subs.filter(s => s.status !== 'expired').length, color: '#6366F1' },
            ].map(s => (
              <div key={s.label} style={{ ...CARD_STYLE, padding: '18px' }}>
                <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Churn by Plan */}
        {planStats.length > 0 && (
          <div style={{ ...CARD_STYLE, marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Churn by Plan</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Plan', 'Active', 'Cancelled', 'Churn Rate', 'Bar'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planStats.map(p => (
                  <tr key={p.plan} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--tx-1)' }}>{p.plan}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#22C55E', fontWeight: 600 }}>{p.active}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#EF4444', fontWeight: 600 }}>{p.cancelled}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: p.rate < 5 ? '#22C55E' : p.rate < 15 ? '#FBBF24' : '#EF4444' }}>{p.rate.toFixed(1)}%</td>
                    <td style={{ padding: '12px 16px', width: '200px' }}>
                      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, p.rate)}%`, backgroundColor: p.rate < 5 ? '#22C55E' : p.rate < 15 ? '#FBBF24' : '#EF4444', borderRadius: '4px' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancellation Timeline */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Cancellation Timeline</h3>
            <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>Last 20 cancelled subscriptions</p>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading…</div>
          ) : recentCancelled.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#22C55E' }}>No cancellations in selected period</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Plan', 'Monthly (₦)', 'Started', 'Cancelled', 'Duration'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCancelled.map(sub => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--tx-1)' }}>{sub.user_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{sub.plan_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{formatNGN(sub.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(sub.started_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#EF4444' }}>{formatDate(sub.cancelled_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{daysBetween(sub.started_at, sub.cancelled_at)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
