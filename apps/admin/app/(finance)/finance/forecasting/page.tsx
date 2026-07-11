'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

function formatNGN(amount: number) {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

function formatMonth(yearMonth: string) {
  const [y, m] = yearMonth.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
}

interface Subscription {
  id: string
  plan_name: string
  amount: number
  currency: string
  status: string
  started_at: string
  cancelled_at: string | null
}

interface MonthlyMRR {
  month: string
  mrr: number
  count: number
}

interface ForecastRow {
  month: string
  projectedMRR: number
  projectedARR: number
  growthRate: number
}

interface PlanBreakdown {
  plan: string
  amount: number
  count: number
  percentage: number
}

export default function ForecastingPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('platform_subscriptions')
      .select('id,plan_name,amount,currency,status,started_at,cancelled_at')
      .order('started_at', { ascending: true })
    setSubs(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const activeSubs = subs.filter(s => s.status === 'active')
  const currentMRR = activeSubs.reduce((sum, s) => sum + (s.amount ?? 0), 0)
  const projectedARR = currentMRR * 12

  // Group active subs by month (started_at)
  const mrrByMonth: Record<string, MonthlyMRR> = {}
  subs.forEach(s => {
    if (!s.started_at) return
    const d = new Date(s.started_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!mrrByMonth[key]) mrrByMonth[key] = { month: key, mrr: 0, count: 0 }
    if (s.status === 'active') {
      mrrByMonth[key].mrr += s.amount ?? 0
      mrrByMonth[key].count++
    }
  })
  const monthlyData = Object.values(mrrByMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)

  // Average monthly growth rate
  let avgGrowth = 0
  if (monthlyData.length >= 2) {
    const rates: number[] = []
    for (let i = 1; i < monthlyData.length; i++) {
      const prev = monthlyData[i - 1].mrr
      const curr = monthlyData[i].mrr
      if (prev > 0) rates.push((curr - prev) / prev)
    }
    avgGrowth = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }

  // 6-month forward projection
  const forecast: ForecastRow[] = []
  let projMRR = currentMRR
  const now = new Date()
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    projMRR = projMRR * (1 + avgGrowth)
    forecast.push({
      month: key,
      projectedMRR: projMRR,
      projectedARR: projMRR * 12,
      growthRate: avgGrowth * 100,
    })
  }

  // Plan breakdown
  const planMap: Record<string, PlanBreakdown> = {}
  activeSubs.forEach(s => {
    if (!planMap[s.plan_name]) planMap[s.plan_name] = { plan: s.plan_name, amount: 0, count: 0, percentage: 0 }
    planMap[s.plan_name].amount += s.amount ?? 0
    planMap[s.plan_name].count++
  })
  const planBreakdown = Object.values(planMap).map(p => ({
    ...p,
    percentage: currentMRR > 0 ? (p.amount / currentMRR) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount)

  const nextMonthProjected = forecast[0]?.projectedMRR ?? currentMRR
  const annualTarget = currentMRR * 1.3 * 12

  const PLAN_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F87171', '#38BDF8', '#A78BFA']

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
        <TopBar title="Revenue Forecasting" subtitle="Subscription growth projections" />
        <div className="p-8 flex items-center justify-center">
          <p style={{ color: 'var(--tx-3)' }}>Loading forecast data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Revenue Forecasting" subtitle="Subscription growth projections — ₦ NGN" />
      <div className="p-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Current MRR', value: formatNGN(currentMRR), sub: `${activeSubs.length} active subs`, color: '#10B981' },
            { label: 'Next Month MRR', value: formatNGN(nextMonthProjected), sub: `${avgGrowth >= 0 ? '+' : ''}${(avgGrowth * 100).toFixed(1)}% growth`, color: '#6366F1' },
            { label: '6-Month Growth', value: forecast.length > 0 ? formatNGN(forecast[forecast.length - 1].projectedMRR) : '—', sub: 'Projected MRR in 6 months', color: '#38BDF8' },
            { label: 'Annual Target', value: formatNGN(annualTarget), sub: 'MRR × 1.3 × 12', color: '#F59E0B' },
          ].map(card => (
            <div key={card.label} style={CARD_STYLE} className="p-5">
              <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>{card.label}</p>
              <p className="text-[22px] font-bold font-display" style={{ color: card.color }}>{card.value}</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 6-Month Forward Forecast Table */}
          <div style={{ ...CARD_STYLE, gridColumn: 'span 2' }} className="p-6">
            <h3 className="text-[14px] font-bold mb-1" style={{ color: 'var(--tx-1)' }}>6-Month Revenue Forecast</h3>
            <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
              Based on {monthlyData.length < 3 ? 'limited' : 'historical'} data — avg growth rate {(avgGrowth * 100).toFixed(1)}%/month
            </p>

            {monthlyData.length < 2 && (
              <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <p className="text-[12px] font-semibold" style={{ color: '#FBBF24' }}>Insufficient data</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>Add subscription data to generate accurate forecasts. Showing flat projection.</p>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Month', 'Projected MRR', 'Projected ARR', 'Growth Rate'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map((row, i) => (
                  <tr key={row.month} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{formatMonth(row.month)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#10B981', fontWeight: 600 }}>{formatNGN(row.projectedMRR)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tx-2)' }}>{formatNGN(row.projectedARR)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <span style={{ color: row.growthRate >= 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>
                        {row.growthRate >= 0 ? '+' : ''}{row.growthRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Plan Breakdown */}
          <div style={CARD_STYLE} className="p-6">
            <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Revenue by Plan</h3>
            {planBreakdown.length === 0 ? (
              <p style={{ color: 'var(--tx-3)' }} className="text-[12px]">No active subscriptions</p>
            ) : (
              <div className="space-y-4">
                {planBreakdown.map((plan, i) => (
                  <div key={plan.plan}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length], flexShrink: 0 }} />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--tx-1)' }}>{plan.plan}</span>
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--tx-3)' }}>{plan.count} sub{plan.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div style={{ flex: 1, height: 6, borderRadius: 4, backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
                        <div style={{ width: `${plan.percentage}%`, height: '100%', borderRadius: 4, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length], transition: 'width 0.5s ease' }} />
                      </div>
                      <span className="text-[11px] font-bold w-12 text-right" style={{ color: 'var(--tx-2)' }}>{plan.percentage.toFixed(0)}%</span>
                    </div>
                    <p className="text-[11px] mt-0.5 text-right" style={{ color: 'var(--tx-3)' }}>{formatNGN(plan.amount)}/mo</p>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div className="flex justify-between">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--tx-2)' }}>Total MRR</span>
                    <span className="text-[14px] font-bold" style={{ color: '#10B981' }}>{formatNGN(currentMRR)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historical MRR Trend */}
        <div style={CARD_STYLE} className="p-6">
          <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Historical MRR Trend (Last 6 Months)</h3>
          {monthlyData.length === 0 ? (
            <p style={{ color: 'var(--tx-3)' }} className="text-[12px]">No historical data available yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {monthlyData.map((m) => {
                const maxMRR = Math.max(...monthlyData.map(d => d.mrr), 1)
                const heightPct = (m.mrr / maxMRR) * 100
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold" style={{ color: '#10B981' }}>{formatNGN(m.mrr)}</span>
                    <div style={{ width: '100%', height: `${heightPct}%`, minHeight: 4, backgroundColor: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(16,185,129,0.5)', borderRadius: '2px 2px 0 0' }} />
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>{formatMonth(m.month).split(' ')[0]}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
