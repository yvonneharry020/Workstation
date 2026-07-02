'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Star, Zap } from 'lucide-react'

const CARD = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const USER_TYPE_OPTIONS = [
  { value: 'candidate', label: 'Candidate', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
  { value: 'company',   label: 'Company',   color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
  { value: 'both',      label: 'Both',      color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
]

const STATUS_CONFIG = {
  active:   { label: 'Active',   color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  draft:    { label: 'Draft',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  archived: { label: 'Archived', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
}

const BILLING_OPTIONS = [
  { value: 'monthly',  label: 'Monthly' },
  { value: 'yearly',   label: 'Yearly' },
  { value: 'one_time', label: 'One-time' },
]

const TAG_OPTIONS = ['Most Popular', 'Best Value', 'Pro', 'Starter', 'Enterprise', 'Free']

interface Plan {
  id: string
  name: string
  description: string | null
  user_type: string
  price_monthly: number
  price_yearly: number | null
  currency: string
  billing_cycle: string
  trial_days: number
  status: string
  is_featured: boolean
  tag: string | null
  sort_order: number
  paystack_plan_code: string | null
  benefits: string[]
  highlights: Record<string, string>
  created_at: string
  updated_at: string
}

const BLANK_FORM = {
  name: '',
  description: '',
  user_type: 'candidate',
  price_monthly: '',
  price_yearly: '',
  billing_cycle: 'monthly',
  trial_days: '0',
  status: 'draft',
  is_featured: false,
  tag: '',
  sort_order: '0',
  paystack_plan_code: '',
  benefits: [''],
  highlights: {} as Record<string, string>,
}

function fmtNGN(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

function UserTypeBadge({ type }: { type: string }) {
  const cfg = USER_TYPE_OPTIONS.find(o => o.value === type) ?? USER_TYPE_OPTIONS[0]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: cfg.color, backgroundColor: cfg.bg, textTransform: 'capitalize' }}>
      {cfg.label}
    </span>
  )
}

export default function PlanBoardPage() {
  const supabase = createClient()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM, benefits: [''] })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [newHighlightKey, setNewHighlightKey] = useState('')
  const [newHighlightVal, setNewHighlightVal] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    setPlans((data ?? []) as Plan[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function openNew() {
    setForm({ ...BLANK_FORM, benefits: [''] })
    setEditingId(null)
    setShowForm(true)
    setNewHighlightKey('')
    setNewHighlightVal('')
  }

  function openEdit(plan: Plan) {
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      user_type: plan.user_type,
      price_monthly: String(plan.price_monthly),
      price_yearly: plan.price_yearly != null ? String(plan.price_yearly) : '',
      billing_cycle: plan.billing_cycle,
      trial_days: String(plan.trial_days),
      status: plan.status,
      is_featured: plan.is_featured,
      tag: plan.tag ?? '',
      sort_order: String(plan.sort_order),
      paystack_plan_code: plan.paystack_plan_code ?? '',
      benefits: plan.benefits?.length ? plan.benefits : [''],
      highlights: { ...(plan.highlights ?? {}) },
    })
    setEditingId(plan.id)
    setShowForm(true)
    setExpandedId(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...BLANK_FORM, benefits: [''] })
  }

  function setBenefit(idx: number, val: string) {
    setForm(p => {
      const benefits = [...p.benefits]
      benefits[idx] = val
      return { ...p, benefits }
    })
  }

  function addBenefit() {
    setForm(p => ({ ...p, benefits: [...p.benefits, ''] }))
  }

  function removeBenefit(idx: number) {
    setForm(p => ({ ...p, benefits: p.benefits.filter((_, i) => i !== idx) }))
  }

  function addHighlight() {
    if (!newHighlightKey.trim()) return
    setForm(p => ({ ...p, highlights: { ...p.highlights, [newHighlightKey.trim()]: newHighlightVal.trim() } }))
    setNewHighlightKey('')
    setNewHighlightVal('')
  }

  function removeHighlight(key: string) {
    setForm(p => {
      const { [key]: _removed, ...rest } = p.highlights
      return { ...p, highlights: rest }
    })
  }

  async function savePlan() {
    if (!form.name.trim() || !form.price_monthly) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      user_type: form.user_type,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly: form.price_yearly ? parseFloat(form.price_yearly) : null,
      currency: 'NGN',
      billing_cycle: form.billing_cycle,
      trial_days: parseInt(form.trial_days) || 0,
      status: form.status,
      is_featured: form.is_featured,
      tag: form.tag.trim() || null,
      sort_order: parseInt(form.sort_order) || 0,
      paystack_plan_code: form.paystack_plan_code.trim() || null,
      benefits: form.benefits.filter(b => b.trim()),
      highlights: form.highlights,
    }

    if (editingId) {
      await supabase.from('subscription_plans').update(payload).eq('id', editingId)
    } else {
      await supabase.from('subscription_plans').insert(payload)
    }

    setSaving(false)
    closeForm()
    void load()
  }

  async function deletePlan(id: string) {
    await supabase.from('subscription_plans').delete().eq('id', id)
    setDeletingId(null)
    void load()
  }

  async function toggleStatus(plan: Plan) {
    const next = plan.status === 'active' ? 'draft' : 'active'
    await supabase.from('subscription_plans').update({ status: next }).eq('id', plan.id)
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: next } : p))
  }

  async function toggleFeatured(plan: Plan) {
    await supabase.from('subscription_plans').update({ is_featured: !plan.is_featured }).eq('id', plan.id)
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_featured: !p.is_featured } : p))
  }

  const filtered = plans.filter(p =>
    (filterType === 'all' || p.user_type === filterType) &&
    (filterStatus === 'all' || p.status === filterStatus)
  )

  const activePlans = plans.filter(p => p.status === 'active').length
  const candidatePlans = plans.filter(p => p.user_type === 'candidate' && p.status === 'active').length
  const companyPlans = plans.filter(p => p.user_type === 'company' && p.status === 'active').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
            Plan Board
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
            Create and manage subscription plans — published directly to the mobile app
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors"
          style={{ backgroundColor: '#6366F1' }}>
          <Plus size={15} /> New Plan
        </button>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Plans',       value: plans.length,     color: '#6366F1' },
            { label: 'Active Plans',      value: activePlans,      color: '#10B981' },
            { label: 'Candidate Plans',   value: candidatePlans,   color: '#38BDF8' },
            { label: 'Company Plans',     value: companyPlans,     color: '#A78BFA' },
          ].map(k => (
            <div key={k.label} style={CARD} className="p-5">
              <p className="text-[26px] font-bold font-display" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {['all', 'candidate', 'company', 'both'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-colors"
                style={{
                  backgroundColor: filterType === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: filterType === t ? '#818CF8' : 'var(--tx-3)',
                  border: `1px solid ${filterType === t ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                }}>
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-4">
            {['all', 'active', 'draft', 'archived'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-colors"
                style={{
                  backgroundColor: filterStatus === s ? 'rgba(16,185,129,0.12)' : 'transparent',
                  color: filterStatus === s ? '#34D399' : 'var(--tx-3)',
                  border: `1px solid ${filterStatus === s ? 'rgba(16,185,129,0.35)' : 'transparent'}`,
                }}>
                {s === 'all' ? 'All Status' : s}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[12px]" style={{ color: 'var(--tx-3)' }}>{filtered.length} plans</span>
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div style={CARD} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[16px] font-bold" style={{ color: 'var(--tx-1)' }}>
                {editingId ? 'Edit Plan' : 'New Subscription Plan'}
              </p>
              <button onClick={closeForm} className="w-7 h-7 rounded-lg flex items-center justify-center border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--tx-3)' }}>
                <X size={13} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Plan Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pro Candidate Plan"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short description of what this plan offers"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none resize-none"
                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>For *</label>
                    <select value={form.user_type} onChange={e => setForm(p => ({ ...p, user_type: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}>
                      {USER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Billing Cycle</label>
                    <select value={form.billing_cycle} onChange={e => setForm(p => ({ ...p, billing_cycle: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}>
                      {BILLING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Monthly Price (₦) *</label>
                    <input type="number" value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: e.target.value }))}
                      placeholder="5000"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Yearly Price (₦)</label>
                    <input type="number" value={form.price_yearly} onChange={e => setForm(p => ({ ...p, price_yearly: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Free Trial Days</label>
                    <input type="number" value={form.trial_days} onChange={e => setForm(p => ({ ...p, trial_days: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Sort Order</label>
                    <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Status</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Badge Tag</label>
                    <select value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}>
                      <option value="">None</option>
                      {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-3)' }}>Paystack Plan Code</label>
                  <input value={form.paystack_plan_code} onChange={e => setForm(p => ({ ...p, paystack_plan_code: e.target.value }))}
                    placeholder="PLN_xxxxxxxxxxxx"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] border outline-none font-mono"
                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                </div>

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#6366F1' }} />
                  <label htmlFor="featured" className="text-[13px] cursor-pointer" style={{ color: 'var(--tx-2)' }}>
                    Mark as Featured (highlighted on mobile app)
                  </label>
                </div>
              </div>

              {/* Right column — Benefits + Highlights */}
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>
                      Plan Benefits
                    </label>
                    <button onClick={addBenefit}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' }}>
                      + Add benefit
                    </button>
                  </div>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--tx-3)' }}>
                    Each benefit appears as a bullet on the mobile app plan card.
                  </p>
                  <div className="space-y-2">
                    {form.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span style={{ color: '#10B981', fontSize: 12 }}>✓</span>
                        <input value={b} onChange={e => setBenefit(i, e.target.value)}
                          placeholder={`Benefit ${i + 1} e.g. Unlimited job applications`}
                          className="flex-1 px-3 py-2 rounded-xl text-[13px] border outline-none"
                          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                        {form.benefits.length > 1 && (
                          <button onClick={() => removeBenefit(i)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Highlights (key-value pairs shown on mobile) */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tx-3)' }}>
                    Plan Highlights (key → value)
                  </label>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--tx-3)' }}>
                    E.g. &quot;Job Alerts&quot; → &quot;Unlimited&quot; or &quot;Profile Views&quot; → &quot;50/month&quot;
                  </p>
                  {Object.entries(form.highlights).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 mb-2">
                      <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'var(--tx-2)' }}>{k}</span>
                      <span className="text-[12px] text-right flex-1 truncate" style={{ color: '#10B981' }}>{v}</span>
                      <button onClick={() => removeHighlight(k)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input value={newHighlightKey} onChange={e => setNewHighlightKey(e.target.value)}
                      placeholder="Feature name"
                      className="flex-1 px-2.5 py-2 rounded-lg text-[12px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                    <input value={newHighlightVal} onChange={e => setNewHighlightVal(e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2.5 py-2 rounded-lg text-[12px] border outline-none"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }} />
                    <button onClick={addHighlight}
                      className="px-3 py-2 rounded-lg text-[12px] font-semibold"
                      style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                      Add
                    </button>
                  </div>
                </div>

                {/* Preview card */}
                {form.name && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>
                      Mobile App Preview
                    </p>
                    <div className="rounded-2xl p-5 relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.1))', border: `2px solid ${form.is_featured ? '#6366F1' : 'rgba(99,102,241,0.2)'}` }}>
                      {form.tag && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: '#6366F1', color: '#fff' }}>
                          {form.tag}
                        </div>
                      )}
                      {form.is_featured && (
                        <div className="flex items-center gap-1 mb-2">
                          <Star size={10} style={{ color: '#F59E0B' }} fill="#F59E0B" />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B' }}>Featured</span>
                        </div>
                      )}
                      <UserTypeBadge type={form.user_type} />
                      <p className="text-[16px] font-bold mt-2" style={{ color: 'var(--tx-1)' }}>{form.name}</p>
                      {form.description && <p className="text-[12px] mt-1" style={{ color: 'var(--tx-3)' }}>{form.description}</p>}
                      <p className="text-[24px] font-black mt-3" style={{ color: '#10B981' }}>
                        {form.price_monthly ? fmtNGN(parseFloat(form.price_monthly) || 0) : '₦—'}
                        <span className="text-[13px] font-normal ml-1" style={{ color: 'var(--tx-3)' }}>/{form.billing_cycle}</span>
                      </p>
                      {parseInt(form.trial_days) > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: '#38BDF8' }}>{form.trial_days}-day free trial</p>
                      )}
                      {form.benefits.filter(b => b.trim()).length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {form.benefits.filter(b => b.trim()).map((b, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Check size={11} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 11, color: 'var(--tx-2)' }}>{b}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => void savePlan()} disabled={saving || !form.name.trim() || !form.price_monthly}
                className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#6366F1' }}>
                {saving ? 'Saving…' : editingId ? 'Update Plan' : 'Create Plan'}
              </button>
              <button onClick={closeForm}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', backgroundColor: 'var(--bg-elevated)' }}>
                Cancel
              </button>
              {editingId && (
                <span className="text-[12px] ml-2" style={{ color: 'var(--tx-3)' }}>
                  Changes publish to mobile app when status is set to Active
                </span>
              )}
            </div>
          </div>
        )}

        {/* Plans grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Zap size={32} style={{ color: 'var(--tx-3)', margin: '0 auto 12px' }} />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--tx-2)' }}>No plans yet</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--tx-3)' }}>
              Click <strong>New Plan</strong> to create your first subscription plan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {filtered.map(plan => {
              const status = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
              const userType = USER_TYPE_OPTIONS.find(o => o.value === plan.user_type) ?? USER_TYPE_OPTIONS[0]
              const isExpanded = expandedId === plan.id

              return (
                <div key={plan.id} style={CARD} className="overflow-hidden">
                  {/* Plan card header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <UserTypeBadge type={plan.user_type} />
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: status.color, backgroundColor: status.bg, border: `1px solid ${status.border}` }}>
                            {status.label}
                          </span>
                          {plan.is_featured && (
                            <span className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B' }}>
                              <Star size={9} fill="#F59E0B" /> Featured
                            </span>
                          )}
                          {plan.tag && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: '#6366F1', color: '#fff' }}>
                              {plan.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[16px] font-bold truncate" style={{ color: 'var(--tx-1)' }}>{plan.name}</p>
                        {plan.description && (
                          <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--tx-3)' }}>{plan.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <p className="text-[22px] font-black" style={{ color: '#10B981' }}>{fmtNGN(plan.price_monthly)}</p>
                        <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>/{plan.billing_cycle}</p>
                        {plan.price_yearly && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                            {fmtNGN(plan.price_yearly)}/yr
                          </p>
                        )}
                      </div>
                    </div>

                    {plan.trial_days > 0 && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg mb-3"
                        style={{ backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>
                        <Zap size={10} style={{ color: '#38BDF8' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#38BDF8' }}>{plan.trial_days}-day free trial</span>
                      </div>
                    )}

                    {/* Benefits preview */}
                    {plan.benefits?.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {(isExpanded ? plan.benefits : plan.benefits.slice(0, 3)).map((b, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Check size={11} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{b}</span>
                          </div>
                        ))}
                        {!isExpanded && plan.benefits.length > 3 && (
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', paddingLeft: 16 }}>
                            +{plan.benefits.length - 3} more benefits
                          </p>
                        )}
                      </div>
                    )}

                    {/* Highlights */}
                    {isExpanded && plan.highlights && Object.keys(plan.highlights).length > 0 && (
                      <div className="rounded-xl p-3 mb-3 space-y-1.5"
                        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        {Object.entries(plan.highlights).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{k}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && plan.paystack_plan_code && (
                      <div className="rounded-lg px-3 py-2 mb-3"
                        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 2 }}>Paystack Plan Code</p>
                        <p style={{ fontSize: 12, color: '#10B981', fontFamily: 'monospace' }}>{plan.paystack_plan_code}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                    <button onClick={() => openEdit(plan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', backgroundColor: 'var(--bg-card)' }}>
                      <Edit3 size={11} /> Edit
                    </button>
                    <button onClick={() => void toggleStatus(plan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                      style={{ color: plan.status === 'active' ? '#F59E0B' : '#10B981', backgroundColor: plan.status === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' }}>
                      {plan.status === 'active' ? 'Set Draft' : 'Set Active'}
                    </button>
                    <button onClick={() => void toggleFeatured(plan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                      style={{ color: plan.is_featured ? '#F59E0B' : 'var(--tx-3)', backgroundColor: plan.is_featured ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                      <Star size={11} fill={plan.is_featured ? '#F59E0B' : 'none'} />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                      className="ml-auto px-2 py-1.5 rounded-lg text-[12px] transition-colors"
                      style={{ color: 'var(--tx-3)' }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {deletingId === plan.id ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => void deletePlan(plan.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                          style={{ backgroundColor: '#EF4444', color: '#fff' }}>Confirm</button>
                        <button onClick={() => setDeletingId(null)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] border"
                          style={{ borderColor: 'var(--border)', color: 'var(--tx-3)' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(plan.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Mobile app sync note */}
        {plans.filter(p => p.status === 'active').length > 0 && (
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Zap size={14} style={{ color: '#818CF8', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#818CF8' }}>
                {plans.filter(p => p.status === 'active').length} active plan{plans.filter(p => p.status === 'active').length > 1 ? 's' : ''} live on mobile app
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                The mobile app reads from <code style={{ fontSize: 11, color: '#A78BFA' }}>subscription_plans</code> where <code style={{ fontSize: 11, color: '#A78BFA' }}>status = &apos;active&apos;</code>.
                Set a plan to <strong>Active</strong> to make it visible to candidates or companies.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
