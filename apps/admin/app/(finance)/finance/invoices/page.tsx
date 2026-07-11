'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface Invoice {
  id: string
  invoice_number: string
  user_id: string | null
  user_email: string
  user_name: string
  plan_name: string
  amount: number
  vat_amount: number
  total_amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  payment_reference: string | null
  paystack_ref: string | null
  due_date: string | null
  issued_at: string
  paid_at: string | null
  notes: string | null
  created_at: string
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  draft:     { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
  sent:      { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)' },
  paid:      { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  overdue:   { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  cancelled: { text: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const VAT_RATE = 0.075

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [form, setForm] = useState({ user_email: '', user_name: '', plan_name: '', amount: '', notes: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    setInvoices((data ?? []) as Invoice[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const filtered = invoices.filter(inv => {
    const matchTab = tab === 'all' || inv.status === tab
    const q = search.toLowerCase()
    const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.user_email.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    outstanding: invoices.filter(i => ['draft', 'sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total_amount ?? 0), 0),
  }

  async function handleSend(id: string) {
    setActing(id)
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i))
    setActing(null)
  }

  async function handleMarkPaid(id: string) {
    setActing(id)
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
    setActing(null)
  }

  function handleDownload(inv: Invoice) {
    const text = [
      `INVOICE`,
      `========================================`,
      `Invoice Number: ${inv.invoice_number}`,
      `Date Issued:    ${formatDate(inv.issued_at)}`,
      `Status:         ${inv.status.toUpperCase()}`,
      ``,
      `BILL TO`,
      `----------------------------------------`,
      `Name:    ${inv.user_name}`,
      `Email:   ${inv.user_email}`,
      ``,
      `DESCRIPTION`,
      `----------------------------------------`,
      `Plan:    ${inv.plan_name}`,
      ``,
      `AMOUNTS`,
      `----------------------------------------`,
      `Subtotal:        ${formatNGN(inv.amount)}`,
      `VAT (7.5%):      ${formatNGN(inv.vat_amount)}`,
      `TOTAL:           ${formatNGN(inv.total_amount)}`,
      ``,
      inv.paystack_ref ? `Payment Ref:     ${inv.paystack_ref}` : '',
      inv.paid_at ? `Paid At:         ${formatDate(inv.paid_at)}` : '',
      ``,
      `========================================`,
      `Workstation — Nigerian Recruitment Platform`,
      `VAT Reg: FIRS 7.5% | NGN`,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCreate() {
    const amt = parseFloat(form.amount)
    if (!form.user_email || !form.user_name || !form.plan_name || isNaN(amt) || amt <= 0) return
    setCreating(true)
    const vatAmt = amt * VAT_RATE
    const totalAmt = amt + vatAmt
    const { error } = await supabase.from('invoices').insert({
      invoice_number: `INV-${Date.now()}`,
      user_email: form.user_email,
      user_name: form.user_name,
      plan_name: form.plan_name,
      amount: amt,
      vat_amount: vatAmt,
      total_amount: totalAmt,
      currency: 'NGN',
      status: 'draft',
      notes: form.notes || null,
    })
    if (!error) {
      setShowDrawer(false)
      setForm({ user_email: '', user_name: '', plan_name: '', amount: '', notes: '' })
      await load()
    }
    setCreating(false)
  }

  const formAmt = parseFloat(form.amount) || 0
  const formVat = formAmt * VAT_RATE
  const formTotal = formAmt + formVat

  const tabs = ['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled']

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Invoices" subtitle="Create and manage platform invoices" />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Invoices', value: stats.total, color: '#6366F1' },
            { label: 'Paid', value: stats.paid, color: '#10B981' },
            { label: 'Overdue', value: stats.overdue, color: '#EF4444' },
            { label: 'Outstanding', value: formatNGN(stats.outstanding), color: '#F59E0B' },
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
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: '1px solid',
                  backgroundColor: tab === t ? 'rgba(16,185,129,0.15)' : 'transparent',
                  borderColor: tab === t ? '#10B981' : 'var(--border)',
                  color: tab === t ? '#10B981' : 'var(--tx-2)',
                  cursor: 'pointer',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice or email…"
            style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', width: '220px', outline: 'none' }}
          />
          <button
            onClick={() => setShowDrawer(true)}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, backgroundColor: '#10B981', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            + Create Invoice
          </button>
        </div>

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading invoices…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <p style={{ fontSize: '15px' }}>No invoices found</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Create your first invoice using the button above.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Invoice #', 'Recipient', 'Plan', 'Amount', 'VAT 7.5%', 'Total', 'Status', 'Issued', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft
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
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)', fontWeight: 500 }}>{formatNGN(inv.amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-3)' }}>{formatNGN(inv.vat_amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)' }}>{formatNGN(inv.total_amount)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--tx-3)' }}>{formatDate(inv.issued_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {inv.status === 'draft' && (
                            <button onClick={() => handleSend(inv.id)} disabled={acting === inv.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', cursor: 'pointer' }}>
                              Send
                            </button>
                          )}
                          {inv.status === 'sent' && (
                            <button onClick={() => handleMarkPaid(inv.id)} disabled={acting === inv.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', cursor: 'pointer' }}>
                              Mark Paid
                            </button>
                          )}
                          <button onClick={() => handleDownload(inv)}
                            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                            Download
                          </button>
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

      {/* Create Invoice Drawer */}
      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDrawer(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '420px',
            backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
            padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx-1)' }}>Create Invoice</h2>
              <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {[
              { label: 'Recipient Email *', key: 'user_email', type: 'email', placeholder: 'user@example.com' },
              { label: 'Recipient Name *', key: 'user_name', type: 'text', placeholder: 'Full name' },
              { label: 'Plan / Service *', key: 'plan_name', type: 'text', placeholder: 'e.g. Professional Plan' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>Amount (₦) *</label>
              <input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' }}
              />
              {formAmt > 0 && (
                <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '12px', color: 'var(--tx-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Subtotal</span><span style={{ fontWeight: 600 }}>{formatNGN(formAmt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>VAT (7.5%)</span><span style={{ fontWeight: 600 }}>{formatNGN(formVat)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(16,185,129,0.2)', paddingTop: '6px', fontWeight: 700, color: '#10B981' }}>
                    <span>Total</span><span>{formatNGN(formTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>Notes (optional)</label>
              <textarea
                placeholder="Additional notes…"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !form.user_email || !form.user_name || !form.plan_name || !form.amount}
              style={{ padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, backgroundColor: creating ? 'rgba(16,185,129,0.5)' : '#10B981', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}
            >
              {creating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
