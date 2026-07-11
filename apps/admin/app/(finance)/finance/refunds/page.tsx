'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface Refund {
  id: string
  subscription_id: string | null
  invoice_id: string | null
  user_email: string
  amount: number
  currency: string
  reason: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'
  paystack_ref: string | null
  paystack_refund_id: string | null
  processed_by: string | null
  processed_at: string | null
  notes: string | null
  created_at: string
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  pending:    { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  approved:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)' },
  processing: { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  completed:  { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  rejected:   { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

export default function RefundsPage() {
  const supabase = createClient()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [acting, setActing] = useState<string | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [form, setForm] = useState({ user_email: '', amount: '', reason: '', subscription_id: '', notes: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('refunds')
      .select('*')
      .order('created_at', { ascending: false })
    setRefunds((data ?? []) as Refund[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const filtered = refunds.filter(r => tab === 'all' || r.status === tab)

  const stats = {
    total: refunds.length,
    pending: refunds.filter(r => r.status === 'pending').length,
    completedAmt: refunds.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount, 0),
    processing: refunds.filter(r => r.status === 'processing').length,
  }

  async function updateStatus(id: string, status: Refund['status']) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('refunds').update({
      status,
      processed_by: user?.email ?? null,
      processed_at: new Date().toISOString(),
    }).eq('id', id)
    setRefunds(prev => prev.map(r => r.id === id ? { ...r, status, processed_at: new Date().toISOString(), processed_by: user?.email ?? null } : r))
    setActing(null)
  }

  async function handleCreate() {
    const amt = parseFloat(form.amount)
    if (!form.user_email || !form.reason || isNaN(amt) || amt <= 0) return
    setCreating(true)
    await supabase.from('refunds').insert({
      user_email: form.user_email,
      amount: amt,
      currency: 'NGN',
      reason: form.reason,
      status: 'pending',
      subscription_id: form.subscription_id || null,
      notes: form.notes || null,
    })
    setShowDrawer(false)
    setForm({ user_email: '', amount: '', reason: '', subscription_id: '', notes: '' })
    await load()
    setCreating(false)
  }

  const tabs = ['all', 'pending', 'approved', 'processing', 'completed', 'rejected']

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Refunds" subtitle="Manage refund requests and Paystack processing" />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Paystack banner */}
        <div style={{ padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>💳</span>
          <p style={{ fontSize: '13px', color: 'var(--tx-2)' }}>
            <strong style={{ color: '#FBBF24' }}>Paystack Refunds:</strong> To process gateway-level refunds, use the Paystack reference to initiate a refund via the{' '}
            <a href="https://dashboard.paystack.com" target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', textDecoration: 'none' }}>Paystack Dashboard</a>.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Refunds', value: stats.total, color: '#6366F1' },
            { label: 'Pending Approval', value: stats.pending, color: '#FBBF24' },
            { label: 'Completed (₦)', value: formatNGN(stats.completedAmt), color: '#10B981' },
            { label: 'Processing', value: stats.processing, color: '#A78BFA' },
          ].map(s => (
            <div key={s.label} style={{ ...CARD_STYLE, padding: '20px' }}>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{s.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...CARD_STYLE, padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                  backgroundColor: tab === t ? 'rgba(16,185,129,0.15)' : 'transparent',
                  borderColor: tab === t ? '#10B981' : 'var(--border)',
                  color: tab === t ? '#10B981' : 'var(--tx-2)',
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setShowDrawer(true)}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, backgroundColor: '#10B981', color: 'white', border: 'none', cursor: 'pointer' }}>
            + Create Refund
          </button>
        </div>

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading refunds…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <p style={{ fontSize: '15px' }}>No refunds found</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Amount', 'Reason', 'Paystack Ref', 'Status', 'Requested', 'Processed', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const s = STATUS_STYLE[r.status]
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{r.user_email}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{formatNGN(r.amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-2)', maxWidth: '200px' }}>{r.reason.length > 50 ? r.reason.slice(0, 50) + '…' : r.reason}</td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--tx-3)', fontFamily: 'monospace' }}>{r.paystack_ref ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(r.created_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(r.processed_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {r.status === 'pending' && (
                            <>
                              <button onClick={() => updateStatus(r.id, 'approved')} disabled={acting === r.id}
                                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', cursor: 'pointer' }}>
                                Approve
                              </button>
                              <button onClick={() => updateStatus(r.id, 'rejected')} disabled={acting === r.id}
                                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <button onClick={() => updateStatus(r.id, 'processing')} disabled={acting === r.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer' }}>
                              Process
                            </button>
                          )}
                          {r.status === 'processing' && (
                            <button onClick={() => updateStatus(r.id, 'completed')} disabled={acting === r.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', cursor: 'pointer' }}>
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Refund Drawer */}
      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDrawer(false)} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '400px', backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx-1)' }}>Create Refund</h2>
              <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            {[
              { label: 'User Email *', key: 'user_email', type: 'email', placeholder: 'user@example.com' },
              { label: 'Amount (₦) *', key: 'amount', type: 'number', placeholder: '0' },
              { label: 'Reason *', key: 'reason', type: 'text', placeholder: 'Reason for refund' },
              { label: 'Subscription ID (optional)', key: 'subscription_id', type: 'text', placeholder: 'UUID' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} placeholder="Additional notes…"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <button onClick={handleCreate} disabled={creating}
              style={{ padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, backgroundColor: creating ? 'rgba(16,185,129,0.5)' : '#10B981', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}>
              {creating ? 'Creating…' : 'Create Refund Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
