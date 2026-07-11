'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }
type DiscountType = 'percentage' | 'fixed'
type FilterType = 'all' | 'active' | 'expired'

interface ReferralCode {
  id: string; code: string; owner_user_id: string | null; owner_email: string | null
  discount_type: DiscountType; discount_value: number; uses_count: number
  max_uses: number | null; expires_at: string | null; is_active: boolean; created_at: string
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpired(code: ReferralCode) {
  return code.expires_at ? new Date(code.expires_at) < new Date() : false
}

function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
}

const EMPTY_FORM = { code: '', owner_email: '', discount_type: 'percentage' as DiscountType, discount_value: '', max_uses: '', expires_at: '', is_active: true }

export default function ReferralsPage() {
  const supabase = createClient()
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showPanel, setShowPanel] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('referral_codes').select('*').order('created_at', { ascending: false })
    setCodes((data ?? []) as ReferralCode[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function getActor() {
    const { data: { user } } = await supabase.auth.getUser(); return user
  }

  async function saveCode() {
    if (!form.code.trim()) return
    setSaving(true)
    await supabase.from('referral_codes').insert({
      code: form.code.trim().toUpperCase(),
      owner_email: form.owner_email || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
      is_active: form.is_active,
    })
    setSaving(false); setShowPanel(false); setForm({ ...EMPTY_FORM }); void load()
  }

  async function toggleActive(c: ReferralCode) {
    setActing(c.id)
    await supabase.from('referral_codes').update({ is_active: !c.is_active }).eq('id', c.id)
    const user = await getActor()
    await supabase.from('audit_logs').insert({ event: 'admin.referral_' + (c.is_active ? 'deactivated' : 'activated'), actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: c.id, target_type: 'referral_code', severity: 'info', app: 'admin_panel' })
    setCodes(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    setActing(null)
  }

  async function deleteCode(id: string) {
    setActing(id)
    await supabase.from('referral_codes').delete().eq('id', id)
    setCodes(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null); setActing(null)
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  function exportCSV() {
    const rows = [['Code', 'Owner Email', 'Type', 'Value', 'Uses', 'Max Uses', 'Expires', 'Active'].join(',')]
    codes.forEach(c => rows.push([c.code, c.owner_email ?? '', c.discount_type, c.discount_value, c.uses_count, c.max_uses ?? 'Unlimited', c.expires_at ?? 'Never', c.is_active ? 'Yes' : 'No'].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'referral-codes.csv'; a.click()
  }

  const activeCodes = codes.filter(c => c.is_active && !isExpired(c))
  const totalUses = codes.reduce((s, c) => s + c.uses_count, 0)
  const revenueSaved = codes.filter(c => c.discount_type === 'fixed').reduce((s, c) => s + c.discount_value * c.uses_count, 0)

  const filtered = codes.filter(c => {
    if (filter === 'active') return c.is_active && !isExpired(c)
    if (filter === 'expired') return isExpired(c) || !c.is_active
    return true
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Referrals & Promos" subtitle="Manage referral and promo discount codes" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Codes', value: codes.length, color: '#F59E0B' },
            { label: 'Active Codes', value: activeCodes.length, color: '#34D399' },
            { label: 'Total Uses', value: totalUses, color: '#38BDF8' },
            { label: 'Fixed Discount Saved', value: '₦' + revenueSaved.toLocaleString('en-NG'), color: '#A78BFA' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[22px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {(['all', 'active', 'expired'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${filter === f ? '#F59E0B' : 'var(--border)'}`, backgroundColor: filter === f ? 'rgba(245,158,11,0.1)' : 'transparent', color: filter === f ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
          ))}
          <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Export CSV</button>
          <button onClick={() => { setShowPanel(true); setForm({ ...EMPTY_FORM }) }} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Code</button>
        </div>

        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No codes found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Code', 'Owner', 'Discount', 'Uses', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const expired = isExpired(c)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx-1)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{c.code}</span>
                          <button onClick={() => copyCode(c.code)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 9, cursor: 'pointer' }}>{copied === c.code ? '✓' : 'Copy'}</button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{c.owner_email ?? '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#34D399' }}>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `₦${Number(c.discount_value).toLocaleString('en-NG')}`}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)' }}>{c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: expired ? '#F87171' : 'var(--tx-3)' }}>{fmtDate(c.expires_at)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ color: expired ? '#F87171' : c.is_active ? '#34D399' : '#9CA3AF', backgroundColor: expired ? 'rgba(239,68,68,0.1)' : c.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)', border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : c.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.3)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{expired ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {confirmDelete === c.id ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => void deleteCode(c.id)} disabled={acting === c.id} style={{ padding: '3px 8px', borderRadius: 5, backgroundColor: '#F87171', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => void toggleActive(c)} disabled={acting === c.id || expired} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${c.is_active ? 'rgba(156,163,175,0.4)' : 'rgba(52,211,153,0.4)'}`, backgroundColor: c.is_active ? 'rgba(156,163,175,0.08)' : 'rgba(52,211,153,0.08)', color: c.is_active ? '#9CA3AF' : '#34D399', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                            <button onClick={() => setConfirmDelete(c.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {showPanel && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 420, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>New Promo Code</h3>
                <button onClick={() => setShowPanel(false)} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Code</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="PROMO2026" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                    <button onClick={() => setForm(p => ({ ...p, code: genCode() }))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Auto-generate</button>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Owner Email (optional)</p>
                  <input value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))} placeholder="user@example.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Discount Type</p>
                  <select value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as DiscountType }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{form.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₦)'}</p>
                  <input type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} placeholder={form.discount_type === 'percentage' ? '10' : '5000'} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Max Uses (blank = unlimited)</p>
                  <input type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="Unlimited" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Expiry Date (optional)</p>
                  <input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#34D399' }} />
                  <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>Active immediately</span>
                </label>
                <button onClick={() => void saveCode()} disabled={saving || !form.code.trim()} style={{ padding: '10px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Creating…' : 'Create Code'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
