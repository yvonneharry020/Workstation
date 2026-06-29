'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const USD_RATE = 1600
function currentYYYYMM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Cost {
  id: string
  month: string
  category: string
  vendor: string
  amount: number
  currency: string
  description: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  email: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
  payments: 'bg-green-900/20 text-green-400 border-green-800/30',
  storage: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  api: 'bg-pink-900/20 text-pink-400 border-pink-800/30',
  other: 'bg-gray-900/20 text-gray-400 border-gray-800/30',
}

const BLANK_FORM = { month: currentYYYYMM(), category: 'infrastructure', vendor: '', amount: '', currency: 'USD', description: '' }

export default function CostsPage() {
  const supabase = createClient()
  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [liveMrrNGN, setLiveMrrNGN] = useState(0)

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: costData }, { data: subData }] = await Promise.all([
      supabase.from('platform_costs').select('*').order('month', { ascending: false }).order('category'),
      supabase.from('platform_subscriptions').select('amount').eq('status', 'active'),
    ])
    setCosts((costData ?? []) as Cost[])
    const mrr = (subData ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
    setLiveMrrNGN(mrr)
    setLoading(false)
  }

  async function addCost() {
    if (!form.vendor || !form.amount) return
    setSaving(true)
    const { data } = await supabase.from('platform_costs').insert({
      month: form.month,
      category: form.category,
      vendor: form.vendor,
      amount: parseFloat(form.amount),
      currency: form.currency,
      description: form.description || null,
    }).select().single()
    if (data) setCosts(prev => [data as Cost, ...prev].sort((a, b) => b.month.localeCompare(a.month)))
    setForm(BLANK_FORM)
    setAdding(false)
    setSaving(false)
  }

  const months = [...new Set(costs.map(c => c.month))].sort().reverse()
  const thisMonth = currentYYYYMM()
  const currentMonthTotalUSD = costs.filter(c => c.month === thisMonth && c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0)
  const currentMonthTotalNGN = costs.filter(c => c.month === thisMonth && c.currency === 'NGN').reduce((sum, c) => sum + c.amount, 0)
  const currentMonthCostNGN = currentMonthTotalUSD * USD_RATE + currentMonthTotalNGN
  const mrrEstUSD = liveMrrNGN / USD_RATE
  const netMarginUSD = mrrEstUSD - currentMonthTotalUSD

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Platform Costs</h1>
          <p className="text-sm text-text-secondary mt-0.5">Monthly infrastructure and operational costs. Track net margin.</p>
        </div>
        <button onClick={() => setAdding(true)} className="px-4 py-2 bg-finance-500 hover:bg-finance-600 text-white text-sm font-semibold rounded-xl transition-colors">+ Add Cost</button>
      </div>

      <div className="px-8 py-4 border-b border-surface-border">
        <div className="flex gap-4">
          <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">This Month Costs (NGN)</p>
            <div className="text-2xl font-bold text-text-primary font-display">₦{Math.round(currentMonthCostNGN).toLocaleString('en-NG')}</div>
            {currentMonthTotalUSD > 0 && <p className="text-[10px] text-text-muted mt-0.5">${currentMonthTotalUSD.toFixed(2)} USD component</p>}
          </div>
          <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Live MRR (from subscriptions)</p>
            <div className="text-2xl font-bold text-finance-400 font-display">₦{Math.round(liveMrrNGN).toLocaleString('en-NG')}</div>
            <p className="text-[10px] text-text-muted mt-0.5">${mrrEstUSD.toFixed(2)} USD equiv</p>
          </div>
          <div className="bg-surface-card border border-finance-800/30 rounded-xl px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Net Margin (USD equiv)</p>
            <div className={`text-2xl font-bold font-display ${netMarginUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>${netMarginUSD.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {adding && (
        <div className="px-8 py-5 border-b border-surface-border bg-finance-900/5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Add Platform Cost</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Month</label>
              <input type="month" value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500">
                {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Vendor</label>
              <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Supabase" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Amount</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="25.00" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500">
                <option>USD</option><option>NGN</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional note" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-finance-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCost} disabled={saving || !form.vendor || !form.amount} className="px-5 py-2 bg-finance-500 hover:bg-finance-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">{saving ? 'Saving…' : 'Add'}</button>
            <button onClick={() => setAdding(false)} className="px-5 py-2 bg-surface-elevated border border-surface-border text-text-secondary text-sm font-semibold rounded-xl hover:text-text-primary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-4xl">
        {loading ? <div className="text-text-muted text-sm">Loading…</div> :
          months.map(month => {
            const monthCosts = costs.filter(c => c.month === month)
            const monthTotal = monthCosts.reduce((sum, c) => sum + c.amount, 0)
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-text-primary">{month}</p>
                  <p className="text-sm font-bold text-text-primary">${monthTotal.toFixed(2)} USD</p>
                </div>
                <div className="space-y-1.5">
                  {monthCosts.map(cost => (
                    <div key={cost.id} className="flex items-center gap-3 px-4 py-3 bg-surface-card border border-surface-border rounded-xl">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 capitalize ${CATEGORY_COLORS[cost.category] ?? ''}`}>{cost.category}</span>
                      <p className="text-sm font-semibold text-text-primary flex-1">{cost.vendor}</p>
                      {cost.description && <p className="text-xs text-text-muted">{cost.description}</p>}
                      <p className="text-sm font-semibold text-text-primary ml-auto flex-shrink-0">${cost.amount.toFixed(2)} {cost.currency}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
