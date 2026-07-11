'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }
const CATEGORIES = ['Infrastructure', 'Marketing', 'Staff', 'Legal', 'Product', 'Operations', 'Other']

interface BudgetEntry { id: string; category: string; month: string; budgeted_amount: number; created_at: string }
interface ActualCost { id: string; category: string; description: string; amount: number; cost_date: string }

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG') }
function yyyymm(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function BudgetPage() {
  const supabase = createClient()
  const now = new Date()
  const [month, setMonth] = useState(yyyymm(now))
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [actuals, setActuals] = useState<ActualCost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: CATEGORIES[0], month: yyyymm(now), budgeted_amount: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [start, end] = [`${month}-01`, `${month}-31`]
    const [bRes, aRes] = await Promise.all([
      supabase.from('budget_entries').select('*').eq('month', month),
      supabase.from('platform_costs').select('*').gte('cost_date', start).lte('cost_date', end),
    ])
    setBudgets((bRes.data ?? []) as BudgetEntry[])
    setActuals((aRes.data ?? []) as ActualCost[])
    setLoading(false)
  }, [supabase, month])

  useEffect(() => { void load() }, [load])

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.budgeted_amount), 0)
  const totalActual = actuals.reduce((s, a) => s + Number(a.amount), 0)
  const variance = totalBudgeted - totalActual
  const utilization = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0

  const categoryMap: Record<string, { budgeted: number; actual: number }> = {}
  budgets.forEach(b => { categoryMap[b.category] = { budgeted: Number(b.budgeted_amount), actual: 0 } })
  actuals.forEach(a => {
    if (!categoryMap[a.category]) categoryMap[a.category] = { budgeted: 0, actual: 0 }
    categoryMap[a.category].actual += Number(a.amount)
  })
  const categories = Object.entries(categoryMap).sort((x, y) => y[1].budgeted - x[1].budgeted)
  const top5 = categories.slice(0, 5)
  const maxVal = Math.max(...top5.map(([, v]) => Math.max(v.budgeted, v.actual)), 1)

  async function saveBudget() {
    if (!form.budgeted_amount) return
    setSaving(true)
    await supabase.from('budget_entries').insert({ category: form.category, month: form.month, budgeted_amount: Number(form.budgeted_amount) })
    setSaving(false)
    setShowForm(false)
    void load()
  }

  function exportCSV() {
    const rows = [['Category', 'Budgeted (₦)', 'Actual (₦)', 'Variance (₦)'].join(',')]
    categories.forEach(([cat, v]) => rows.push([cat, v.budgeted, v.actual, v.budgeted - v.actual].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `budget-${month}.csv`; a.click()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Budget vs Actuals" subtitle="Compare planned budget against actual platform spending" />
      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Budgeted', value: fmt(totalBudgeted), color: '#38BDF8' },
            { label: 'Total Actual', value: fmt(totalActual), color: '#F59E0B' },
            { label: 'Variance', value: fmt(Math.abs(variance)), color: variance >= 0 ? '#34D399' : '#F87171' },
            { label: 'Utilization', value: `${utilization}%`, color: utilization > 100 ? '#F87171' : utilization > 80 ? '#FBBF24' : '#34D399' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[22px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
          <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Budget</button>
          <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Export CSV</button>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ ...CARD, padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 14 }}>Add Budget Entry</h4>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Category</p>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Month</p>
                <input type="month" value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Budgeted Amount (₦)</p>
                <input type="number" value={form.budgeted_amount} onChange={e => setForm(p => ({ ...p, budgeted_amount: e.target.value }))} placeholder="0" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', width: 140 }} />
              </div>
              <button onClick={() => void saveBudget()} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: '#34D399', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Bar chart */}
        {top5.length > 0 && (
          <div style={CARD} className="p-6">
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 16 }}>Top 5 Categories — Budget vs Actual</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {top5.map(([cat, v]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600 }}>{cat}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{fmt(v.budgeted)} budgeted / {fmt(v.actual)} actual</span>
                  </div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 4, backgroundColor: 'rgba(156,163,175,0.2)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(v.budgeted / maxVal) * 100}%`, backgroundColor: 'rgba(99,102,241,0.3)', borderRadius: 4 }} />
                    <div style={{ position: 'absolute', left: 0, top: '25%', height: '50%', width: `${(v.actual / maxVal) * 100}%`, backgroundColor: v.actual > v.budgeted ? '#F87171' : '#34D399', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category table */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : categories.length === 0 ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No budget entries for {month}</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Category', 'Budgeted (₦)', 'Actual (₦)', 'Variance (₦)', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(([cat, v]) => {
                  const vari = v.budgeted - v.actual
                  return (
                    <tr key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 600 }}>{cat}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--tx-2)' }}>{fmt(v.budgeted)}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--tx-2)' }}>{fmt(v.actual)}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: vari >= 0 ? '#34D399' : '#F87171' }}>{vari >= 0 ? '+' : ''}{fmt(vari)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ color: vari >= 0 ? '#34D399' : '#F87171', backgroundColor: vari >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${vari >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{vari >= 0 ? 'Under Budget' : 'Over Budget'}</span>
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
