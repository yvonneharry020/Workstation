'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sub {
  plan_name: string
  plan_code: string
  amount: number
  status: string
  user_type: string
}

interface PlanStat {
  name: string
  code: string
  amount: number
  userType: string
  active: number
  cancelled: number
  past_due: number
  total: number
  mrr: number
  churnRate: number
}

function fmt(amount: number) { return `₦${amount.toLocaleString('en-NG')}` }

const COLORS = ['#10B981', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444']

export default function PlansPage() {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanStat[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMrr, setTotalMrr] = useState(0)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_subscriptions').select('plan_name,plan_code,amount,status,user_type')
    if (!data) { setLoading(false); return }
    const subs = data as Sub[]
    const planMap = new Map<string, PlanStat>()
    subs.forEach(s => {
      if (!planMap.has(s.plan_name)) {
        planMap.set(s.plan_name, { name: s.plan_name, code: s.plan_code, amount: s.amount, userType: s.user_type, active: 0, cancelled: 0, past_due: 0, total: 0, mrr: 0, churnRate: 0 })
      }
      const p = planMap.get(s.plan_name)!
      p.total += 1
      if (s.status === 'active') { p.active += 1; p.mrr += s.amount }
      if (s.status === 'cancelled') p.cancelled += 1
      if (s.status === 'past_due') p.past_due += 1
    })
    const result = Array.from(planMap.values()).map(p => ({ ...p, churnRate: p.total > 0 ? Math.round((p.cancelled / p.total) * 100) : 0 }))
    setPlans(result)
    setTotalMrr(result.reduce((sum, p) => sum + p.mrr, 0))
    setLoading(false)
  }

  const svgSize = 160
  const cx = svgSize / 2
  const cy = svgSize / 2
  const r = 60
  const totalActive = plans.reduce((s, p) => s + p.active, 0)

  let startAngle = -Math.PI / 2
  const arcs = plans.filter(p => p.active > 0).map((p, i) => {
    const pct = totalActive > 0 ? p.active / totalActive : 0
    const angle = pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(startAngle + angle)
    const y2 = cy + r * Math.sin(startAngle + angle)
    const large = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    const arc = { path, color: COLORS[i % COLORS.length], label: p.name, pct: Math.round(pct * 100) }
    startAngle += angle
    return arc
  })

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Plan Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">Subscription plan performance, churn, and revenue breakdown.</p>
      </div>

      <div className="px-8 py-6 max-w-5xl space-y-6">
        {loading ? <div className="text-text-muted text-sm">Loading…</div> : (
          <>
            <div className="flex gap-6">
              <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex items-center gap-6">
                <svg width={svgSize} height={svgSize}>
                  {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} opacity="0.9" />)}
                  <circle cx={cx} cy={cy} r={r * 0.55} fill="#09080E" />
                  <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{totalActive}</text>
                  <text x={cx} y={cy + 10} textAnchor="middle" fill="#94A3B8" fontSize="9">active subs</text>
                </svg>
                <div className="space-y-2">
                  {arcs.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      <span className="text-xs text-text-secondary">{a.label}</span>
                      <span className="text-xs font-bold text-text-primary ml-2">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                {plans.map(p => (
                  <div key={p.name} className="bg-surface-card border border-surface-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-text-primary">{p.name}</p>
                    <p className="text-[10px] text-text-muted capitalize">{p.userType} plan · {fmt(p.amount)}/mo</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Active</span><span className="text-green-400 font-semibold">{p.active}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Cancelled</span><span className="text-red-400 font-semibold">{p.cancelled}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Past Due</span><span className="text-orange-400 font-semibold">{p.past_due}</span></div>
                      <div className="flex justify-between text-xs pt-1 border-t border-surface-border"><span className="text-text-muted">MRR</span><span className="text-finance-400 font-bold">{fmt(p.mrr)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Churn Rate</span><span className={`font-semibold ${p.churnRate > 20 ? 'text-red-400' : 'text-text-primary'}`}>{p.churnRate}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-card border border-finance-800/30 rounded-xl p-5">
              <p className="text-sm font-semibold text-text-primary mb-2">Total MRR</p>
              <p className="text-3xl font-bold text-finance-400 font-display">{fmt(totalMrr)}</p>
              <p className="text-xs text-text-muted mt-1">Across {totalActive} active subscriptions on {plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
