'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface Failure {
  id: string
  user_email: string
  amount: number
  currency: string
  gateway_ref: string | null
  reason: string | null
  attempt_count: number | null
  last_attempt_at: string | null
  created_at: string
}

interface RecentSub {
  id: string
  user_name: string
  plan_name: string
  amount: number
  status: string
  paystack_ref: string | null
  started_at: string
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeDiff(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const STATUS_STYLE: Record<string, { text: string; bg: string }> = {
  active:    { text: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  cancelled: { text: '#F87171', bg: 'rgba(239,68,68,0.1)' },
  past_due:  { text: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
  trialing:  { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
  expired:   { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
}

const PAYSTACK_STATES = [
  { status: 'success', color: '#22C55E', desc: 'Payment was successful and value given to the customer.' },
  { status: 'failed', color: '#EF4444', desc: 'Payment was not successful. Customer should try again.' },
  { status: 'abandoned', color: '#F97316', desc: 'Customer started the payment process but never completed.' },
  { status: 'reversed', color: '#A78BFA', desc: 'Payment was refunded by Paystack support.' },
  { status: 'queued', color: '#38BDF8', desc: 'Transaction is in queue to be processed.' },
  { status: 'pending', color: '#FBBF24', desc: 'Transaction initiated, awaiting payment confirmation.' },
  { status: 'ongoing', color: '#6366F1', desc: 'Transaction is currently being processed.' },
]

export default function GatewayPage() {
  const supabase = createClient()
  const [failures, setFailures] = useState<Failure[]>([])
  const [subs, setSubs] = useState<RecentSub[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: failData }, { data: subData }] = await Promise.all([
      supabase.from('payment_failures').select('id,user_email,amount,currency,gateway_ref,reason,attempt_count,last_attempt_at,created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('platform_subscriptions').select('id,user_name,plan_name,amount,status,paystack_ref,started_at').order('started_at', { ascending: false }).limit(20),
    ])
    setFailures((failData ?? []) as Failure[])
    setSubs((subData ?? []) as RecentSub[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? ''
  const env = paystackKey.startsWith('pk_live_') ? 'Live' : paystackKey.startsWith('pk_test_') ? 'Test' : 'Unknown'
  const envColor = env === 'Live' ? '#22C55E' : '#FBBF24'

  const activeSubs = subs.filter(s => s.status === 'active')
  const totalProcessed = activeSubs.reduce((sum, s) => sum + s.amount, 0)
  const failRate = (failures.length + activeSubs.length) > 0 ? (failures.length / (failures.length + activeSubs.length)) * 100 : 0

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Paystack Gateway" subtitle="Payment gateway monitoring and configuration" />

      <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
        {/* Gateway Status Banner */}
        <div style={{ padding: '14px 20px', borderRadius: '12px', backgroundColor: env === 'Live' ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${env === 'Live' ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`, marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: envColor, boxShadow: `0 0 8px ${envColor}` }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: envColor }}>Paystack {env} Mode</span>
            {paystackKey && <span style={{ fontSize: '12px', color: 'var(--tx-3)', fontFamily: 'monospace' }}>{paystackKey.slice(0, 16)}…</span>}
          </div>
          <a href="https://dashboard.paystack.com" target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', textDecoration: 'none' }}>
            Open Paystack Dashboard ↗
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Successful Transactions', value: activeSubs.length, color: '#10B981' },
            { label: 'Failed Transactions', value: failures.length, color: '#EF4444' },
            { label: 'Gateway Failure Rate', value: `${failRate.toFixed(1)}%`, color: failRate < 5 ? '#22C55E' : failRate < 15 ? '#FBBF24' : '#EF4444' },
            { label: 'Total Processed', value: formatNGN(totalProcessed), color: '#6366F1' },
          ].map(s => (
            <div key={s.label} style={{ ...CARD_STYLE, padding: '20px' }}>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{s.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Payment Failures */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Recent Payment Failures</h3>
            </div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading…</div>
            ) : failures.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#22C55E' }}>No payment failures</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '360px' }}>
                {failures.map(f => (
                  <div key={f.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-1)' }}>{f.user_email}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF4444' }}>{formatNGN(f.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--tx-3)', fontFamily: 'monospace' }}>{f.gateway_ref ?? 'No ref'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{f.last_attempt_at ? timeDiff(f.last_attempt_at) : timeDiff(f.created_at)}</span>
                    </div>
                    {f.reason && <p style={{ fontSize: '11px', color: '#FB923C', marginTop: '4px' }}>{f.reason}</p>}
                    {f.attempt_count && f.attempt_count > 1 && <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '2px' }}>{f.attempt_count} attempt{f.attempt_count !== 1 ? 's' : ''}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paystack Status Guide */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Paystack Transaction States</h3>
            </div>
            <div style={{ padding: '12px' }}>
              {PAYSTACK_STATES.map(ps => (
                <div key={ps.status} style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ps.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: ps.color, textTransform: 'uppercase' }}>{ps.status}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginLeft: '16px' }}>{ps.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Subscriptions */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Recent Subscriptions</h3>
            <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>With Paystack references</p>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Plan', 'Amount', 'Status', 'Paystack Ref', 'Started'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const ss = STATUS_STYLE[s.status] ?? { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' }
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--tx-1)' }}>{s.user_name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{s.plan_name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{formatNGN(s.amount)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: ss.bg, color: ss.text, border: `1px solid ${ss.text}44` }}>{s.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--tx-3)', fontFamily: 'monospace' }}>{s.paystack_ref ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(s.started_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
