'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface AgingInvoice {
  id: string
  invoice_number: string
  user_name: string
  user_email: string
  plan_name: string
  amount: number
  vat_amount: number
  total_amount: number
  status: string
  due_date: string
  issued_at: string
  daysOverdue: number
  bucket: '0-30' | '31-60' | '61-90' | '90+'
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const BUCKET_CONFIG = {
  '0-30':  { label: 'Current (0–30 days)',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)' },
  '31-60': { label: '31–60 Days',           color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  '61-90': { label: '61–90 Days',           color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  '90+':   { label: 'Over 90 Days',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

function getBucket(days: number): AgingInvoice['bucket'] {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export default function AgingPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<AgingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    const { data } = await supabase
      .from('invoices')
      .select('id,invoice_number,user_name,user_email,plan_name,amount,vat_amount,total_amount,status,due_date,issued_at')
      .or('status.eq.overdue,and(status.eq.sent,due_date.lt.' + today.toISOString() + ')')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })

    const enriched = ((data ?? []) as AgingInvoice[]).map(inv => {
      const due = new Date(inv.due_date)
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
      return { ...inv, daysOverdue: Math.max(0, days), bucket: getBucket(Math.max(0, days)) }
    }).sort((a, b) => b.daysOverdue - a.daysOverdue)

    setInvoices(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const totalOutstanding = invoices.reduce((s, i) => s + i.total_amount, 0)

  const bucketStats = (Object.keys(BUCKET_CONFIG) as AgingInvoice['bucket'][]).map(k => ({
    key: k,
    ...BUCKET_CONFIG[k],
    count: invoices.filter(i => i.bucket === k).length,
    amount: invoices.filter(i => i.bucket === k).reduce((s, i) => s + i.total_amount, 0),
  }))

  async function sendReminder(id: string) {
    setActing(id)
    await supabase.from('invoices').update({ notes: `Reminder sent ${new Date().toLocaleDateString('en-NG')}` }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i } : i))
    setActing(null)
  }

  async function markOverdue(id: string) {
    setActing(id)
    await supabase.from('invoices').update({ status: 'overdue' }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'overdue' } : i))
    setActing(null)
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="AR Aging Report" subtitle="Accounts receivable aging analysis" />

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Total Outstanding Hero */}
        <div style={{ ...CARD_STYLE, padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.05))', borderColor: 'rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '12px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Total Outstanding Balance</p>
          <p style={{ fontSize: '40px', fontWeight: 800, color: '#EF4444' }}>{formatNGN(totalOutstanding)}</p>
          <p style={{ fontSize: '13px', color: 'var(--tx-3)', marginTop: '4px' }}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} past due</p>
        </div>

        {/* Bucket Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {bucketStats.map(b => (
            <div key={b.key} onClick={() => setExpandedBucket(expandedBucket === b.key ? null : b.key)}
              style={{ ...CARD_STYLE, padding: '20px', cursor: 'pointer', borderColor: expandedBucket === b.key ? b.color : 'var(--border)', transition: 'border-color 0.2s' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: b.color, marginBottom: '8px' }}>{b.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: b.color }}>{formatNGN(b.amount)}</p>
              <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '4px' }}>{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>

        {/* Aging Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Overdue Invoices</h3>
            <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>Sorted by days overdue (highest first). Click bucket cards to filter.</p>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading aging data…</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>✅</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#22C55E' }}>No overdue invoices</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>All invoices are current.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Invoice #', 'Recipient', 'Plan', 'Amount', 'Due Date', 'Days Overdue', 'Bucket', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices
                  .filter(i => !expandedBucket || i.bucket === expandedBucket)
                  .map(inv => {
                    const b = BUCKET_CONFIG[inv.bucket]
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#10B981', fontFamily: 'monospace' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-1)' }}>{inv.user_name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{inv.user_email}</p>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{inv.plan_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)' }}>{formatNGN(inv.total_amount)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(inv.due_date)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: b.color }}>{inv.daysOverdue}d</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                            {inv.bucket}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => sendReminder(inv.id)} disabled={acting === inv.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', cursor: 'pointer' }}>
                              Send Reminder
                            </button>
                            {inv.status !== 'overdue' && (
                              <button onClick={() => markOverdue(inv.id)} disabled={acting === inv.id}
                                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
                                Mark Overdue
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
    </div>
  )
}
