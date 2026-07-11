'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface PaidInvoice {
  id: string
  invoice_number: string
  user_name: string
  plan_name: string
  amount: number
  vat_amount: number
  total_amount: number
  paid_at: string
}

interface MonthlyVat {
  month: string
  revenue: number
  vat: number
  count: number
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const VAT_RATE = 0.075

export default function VatPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<PaidInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [firsTin, setFirsTin] = useState('')
  const [regState, setRegState] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: invData }, { data: tinRow }, { data: stateRow }] = await Promise.all([
      supabase.from('invoices').select('id,invoice_number,user_name,plan_name,amount,vat_amount,total_amount,paid_at').eq('status', 'paid').order('paid_at', { ascending: false }),
      supabase.from('platform_config').select('value').eq('key', 'vat.firs_tin').maybeSingle(),
      supabase.from('platform_config').select('value').eq('key', 'vat.registration_state').maybeSingle(),
    ])
    setInvoices((invData ?? []) as PaidInvoice[])
    setFirsTin(tinRow?.value ?? '')
    setRegState(stateRow?.value ?? '')
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function saveVatConfig() {
    setSaving(true)
    await Promise.all([
      supabase.from('platform_config').upsert({ key: 'vat.firs_tin', value: firsTin, description: 'FIRS Tax Identification Number' }, { onConflict: 'key' }),
      supabase.from('platform_config').upsert({ key: 'vat.registration_state', value: regState, description: 'State of VAT registration' }, { onConflict: 'key' }),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ytdPrefix = String(now.getFullYear())

  const vatThisMonth = invoices.filter(i => i.paid_at.startsWith(currentMonth)).reduce((s, i) => s + (i.vat_amount ?? 0), 0)
  const vatYtd = invoices.filter(i => i.paid_at.startsWith(ytdPrefix)).reduce((s, i) => s + (i.vat_amount ?? 0), 0)
  const totalVat = invoices.reduce((s, i) => s + (i.vat_amount ?? 0), 0)

  const nextFiling = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 21)
    return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })
  })()

  const monthly: MonthlyVat[] = Object.values(
    invoices.reduce<Record<string, MonthlyVat>>((acc, inv) => {
      const m = inv.paid_at.slice(0, 7)
      if (!acc[m]) acc[m] = { month: m, revenue: 0, vat: 0, count: 0 }
      acc[m].revenue += inv.amount
      acc[m].vat += inv.vat_amount
      acc[m].count += 1
      return acc
    }, {})
  ).sort((a, b) => b.month.localeCompare(a.month))

  function exportCsv() {
    const rows = [
      ['Invoice Number', 'User', 'Plan', 'Date Paid', 'Revenue (NGN)', 'VAT 7.5% (NGN)', 'Total (NGN)'],
      ...invoices.map(i => [i.invoice_number, i.user_name, i.plan_name, formatDate(i.paid_at), Math.round(i.amount), Math.round(i.vat_amount), Math.round(i.total_amount)]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vat-report-${currentMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="VAT & Tax" subtitle="Nigerian FIRS VAT compliance — 7.5% standard rate" />

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'VAT This Month', value: formatNGN(vatThisMonth), color: '#10B981' },
            { label: 'VAT YTD', value: formatNGN(vatYtd), color: '#6366F1' },
            { label: 'Total VAT Collected', value: formatNGN(totalVat), color: '#F59E0B' },
            { label: 'Next FIRS Filing', value: nextFiling, color: '#EF4444', small: true },
          ].map(s => (
            <div key={s.label} style={{ ...CARD_STYLE, padding: '20px' }}>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{s.label}</p>
              <p style={{ fontSize: s.small ? '16px' : '26px', fontWeight: 700, color: s.color }}>{s.value}</p>
              {s.label === 'Total VAT Collected' && <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '4px' }}>Payable to FIRS</p>}
            </div>
          ))}
        </div>

        {/* Monthly breakdown */}
        <div style={{ ...CARD_STYLE, marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)' }}>Monthly VAT Breakdown</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>Aggregated from paid invoices</p>
            </div>
            <button onClick={exportCsv}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
              Export VAT Report CSV
            </button>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>Loading…</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>📋</p>
              <p style={{ fontSize: '15px', fontWeight: 600 }}>No paid invoices yet</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>VAT data will appear here once invoices are marked as paid.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Month', 'Invoice Count', 'Revenue', 'VAT (7.5%)', 'VAT %'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--tx-1)' }}>{m.month}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{m.count}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{formatNGN(m.revenue)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#10B981' }}>{formatNGN(m.vat)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-3)' }}>7.5%</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)' }}>TOTAL</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)' }}>{invoices.length}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)' }}>{formatNGN(invoices.reduce((s, i) => s + i.amount, 0))}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#10B981' }}>{formatNGN(totalVat)}</td>
                  <td style={{ padding: '12px 16px' }}></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* VAT Settings */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx-1)', marginBottom: '20px' }}>VAT Configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>VAT Rate</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#10B981' }}>7.5%</p>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '4px' }}>Nigeria FIRS Standard Rate</p>
            </div>
            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Filing Frequency</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#6366F1' }}>Monthly</p>
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '4px' }}>Due by 21st of following month</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>FIRS Tax Identification Number (TIN)</label>
              <input value={firsTin} onChange={e => setFirsTin(e.target.value)} placeholder="e.g. 0000000000-0001"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '6px' }}>Registration State</label>
              <input value={regState} onChange={e => setRegState(e.target.value)} placeholder="e.g. Lagos"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button onClick={saveVatConfig} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: saved ? '#10B981' : 'rgba(16,185,129,0.1)', color: saved ? 'white' : '#10B981', border: '1px solid rgba(16,185,129,0.3)', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save VAT Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
