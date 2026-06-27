'use client'

import { useState, useMemo } from 'react'
import { Users, Building2, Shield, Activity, Download } from 'lucide-react'
import {
  ComposedChart, AreaChart, BarChart, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  ALL_DATA, filterByRange, filterByMonth, aggregateData, computeStats,
  computeHealthScore, generateInsights,
  GEO_DATA, ACQUISITION_FUNNEL, SUBSCRIPTION_TIERS, REJECTION_REASONS,
} from './data'
import {
  ChartTooltip, KpiCard, ChartCard, LegendDot, InsightCard,
  MonthPicker, DateRangePicker, TICK,
} from './components'

// ─── SVG gradient defs ────────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      <linearGradient id="gIndigo"  x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.25} />
        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.01} />
      </linearGradient>
      <linearGradient id="gCyan"    x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.25} />
        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.01} />
      </linearGradient>
      <linearGradient id="gEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.22} />
        <stop offset="95%" stopColor="#10B981" stopOpacity={0.01} />
      </linearGradient>
      <linearGradient id="gAmber"   x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.22} />
        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.01} />
      </linearGradient>
      <linearGradient id="gViolet"  x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.22} />
        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01} />
      </linearGradient>
    </defs>
  )
}

const healthColor = (s: number) =>
  s >= 85 ? '#6366F1' : s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#EF4444'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 10, padding: '13px 16px', flex: 1 }}>
      <p style={{ color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</p>
      <p style={{ color: 'var(--tx-1)', fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</p>
      {sub && <p style={{ color: 'var(--tx-3)', fontSize: 10, marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

type FilterMode = 'quick' | 'month' | 'range'

export default function AnalyticsPage() {
  const [mode,        setMode]        = useState<FilterMode>('quick')
  const [quickDays,   setQuickDays]   = useState(30)
  const [monthFilter, setMonthFilter] = useState<{ year: number; month: number } | null>(null)
  const [rangeFilter, setRangeFilter] = useState<{ start: Date; end: Date } | null>(null)
  const [tableLimit,  setTableLimit]  = useState(30)

  const rawData = useMemo(() => {
    if (mode === 'month' && monthFilter) return filterByMonth(monthFilter.year, monthFilter.month)
    if (mode === 'range' && rangeFilter)  return filterByRange(rangeFilter.start, rangeFilter.end)
    const last  = ALL_DATA[ALL_DATA.length - 1].dateObj
    const start = new Date(last); start.setDate(start.getDate() - (quickDays - 1))
    return filterByRange(start, last)
  }, [mode, monthFilter, rangeFilter, quickDays])

  const chartData = useMemo(() => aggregateData(rawData), [rawData])

  const prevData = useMemo(() => {
    if (!rawData.length) return []
    const firstDate = rawData[0].dateObj
    const prevEnd   = new Date(firstDate); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd);   prevStart.setDate(prevStart.getDate() - rawData.length + 1)
    return filterByRange(prevStart, prevEnd)
  }, [rawData])

  const stats       = useMemo(() => computeStats(rawData, prevData),  [rawData, prevData])
  const healthScore = useMemo(() => computeHealthScore(stats),         [stats])
  const insights    = useMemo(() => generateInsights(rawData, stats),  [rawData, stats])

  const applyMonth = (y: number, m: number) => { setMonthFilter({ year: y, month: m }); setMode('month') }
  const applyRange = (s: Date, e: Date)      => { setRangeFilter({ start: s, end: e });  setMode('range') }
  const clearMonth = ()                       => { setMonthFilter(null); setMode('quick') }
  const clearRange = ()                       => { setRangeFilter(null); setMode('quick') }

  const fmtM = (n: number) => `₦${(n / 1_000_000).toFixed(1)}M`
  const hc   = healthColor(healthScore)

  const tableData = useMemo(() => [...chartData].reverse().slice(0, tableLimit), [chartData, tableLimit])

  const avgResH = rawData.length
    ? Math.round(rawData.reduce((s, d) => s + d.avgResolutionHours, 0) / rawData.length)
    : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1420, margin: '0 auto' }}>

      {/* ─── Filter bar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--tx-1)', fontSize: 20, fontWeight: 700 }}>Platform Analytics</h1>
          <p style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 3 }}>
            {rawData.length} day{rawData.length !== 1 ? 's' : ''} · {chartData.length} data point{chartData.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {([7, 30, 90] as const).map(d => (
            <button key={d}
              onClick={() => { setQuickDays(d); setMode('quick'); setMonthFilter(null); setRangeFilter(null) }}
              style={{
                padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${mode === 'quick' && quickDays === d ? '#6366F1' : 'var(--border)'}`,
                backgroundColor: mode === 'quick' && quickDays === d ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                color: mode === 'quick' && quickDays === d ? '#6366F1' : 'var(--tx-2)',
              }}>
              {d}D
            </button>
          ))}
          <div style={{ width: 1, height: 24, backgroundColor: 'var(--border)' }} />
          <MonthPicker
            value={mode === 'month' ? monthFilter : null}
            onChange={applyMonth} onClear={clearMonth}
          />
          <DateRangePicker
            value={mode === 'range' ? rangeFilter : null}
            onChange={applyRange} onClear={clearRange}
          />
          <button style={{
            padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* ─── Health Score + Insights ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <p style={{ color: 'var(--tx-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Platform Health</p>
          <div style={{ width: 100, height: 100, borderRadius: '50%', border: `6px solid ${hc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${hc}12` }}>
            <span style={{ color: hc, fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{healthScore}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: hc }} />
            <span style={{ color: hc, fontSize: 12, fontWeight: 600 }}>
              {healthScore >= 85 ? 'Excellent' : healthScore >= 70 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Needs attention'}
            </span>
          </div>
          <p style={{ color: 'var(--tx-3)', fontSize: 10, textAlign: 'center' }}>Pass · Fraud · SLA · Growth</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            {insights.slice(0, 2).map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            {insights.slice(2, 4).map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        </div>
      </div>

      {/* ─── KPI Strip ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Candidates" value={stats.totalCandidates.toLocaleString()} delta={stats.candidateDelta} sub="vs prev period" Icon={Users}     color="#6366F1" />
        <KpiCard label="Companies"  value={stats.totalCompanies.toLocaleString()}  delta={stats.companyDelta}   sub="vs prev period" Icon={Building2} color="#06B6D4" />
        <KpiCard label="Pass Rate"  value={`${stats.avgPassRate}%`}                delta={stats.passDelta}      sub="avg in period"  Icon={Shield}    color="#10B981" />
        <KpiCard label="Revenue"    value={fmtM(stats.totalRevenueNGN)}            delta={stats.revenueDelta}   sub="vs prev period" Icon={Activity}  color="#F59E0B" />
      </div>

      {/* ─── User Growth ────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="Candidate & Company Growth" sub="New registrations over the selected period"
          right={<div style={{ display: 'flex', gap: 14 }}><LegendDot color="#6366F1" label="Candidates" /><LegendDot color="#06B6D4" label="Companies" /></div>}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="l" type="monotone" dataKey="candidates" name="Candidates" stroke="#6366F1" strokeWidth={2} fill="url(#gIndigo)"  dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="companies"  name="Companies"  stroke="#06B6D4" strokeWidth={2} fill="url(#gCyan)"    dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Acquisition Funnel + Geographic ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Acquisition Funnel" sub="Conversion rate at each onboarding stage">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACQUISITION_FUNNEL.map((s, i) => (
              <div key={s.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: 'var(--tx-2)', fontSize: 11 }}>{s.stage}</span>
                  <span style={{ color: 'var(--tx-1)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {s.pct}% · {s.count.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 7, borderRadius: 4, backgroundColor: 'var(--bg-elevated)' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, borderRadius: 4, backgroundColor: ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444'][i] }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Geographic Distribution" sub="Candidate registrations by Nigerian city">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={GEO_DATA} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="city" tick={TICK} tickLine={false} axisLine={false} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Candidates" radius={[0, 4, 4, 0]}>
                {GEO_DATA.map((_, i) => (
                  <Cell key={i} fill={['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── DAU Engagement + Job Market ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Active User Engagement" sub="Daily active users across the period"
          right={
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: 'var(--tx-1)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{stats.avgActiveUsers.toLocaleString()}</p>
              <p style={{ color: 'var(--tx-3)', fontSize: 10 }}>avg DAU</p>
            </div>
          }>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="activeUsers" name="Active Users" stroke="#8B5CF6" strokeWidth={2} fill="url(#gViolet)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Job Market Health" sub="Applications volume and jobs activity"
          right={<div style={{ display: 'flex', gap: 14 }}><LegendDot color="#6366F1" label="Applications" /><LegendDot color="#10B981" label="Jobs Posted" /></div>}>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="l" type="monotone" dataKey="applications" name="Applications" stroke="#6366F1" strokeWidth={2} fill="url(#gIndigo)"  dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="jobsPosted"   name="Jobs Posted"  stroke="#10B981" strokeWidth={2} fill="url(#gEmerald)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Stat label="Applications"  value={stats.totalApplications.toLocaleString()} />
            <Stat label="Jobs Posted"   value={stats.totalJobsPosted.toLocaleString()} />
            <Stat label="Fill Rate"     value={`${stats.fillRate}%`} sub="jobs filled" />
          </div>
        </ChartCard>
      </div>

      {/* ─── Verification + Badge Economy ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Verification Pass Rate" sub="Daily pass rate · 80% target line">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 3"
                label={{ value: 'Target 80%', position: 'insideTopRight', fill: '#F59E0B', fontSize: 10 }} />
              <Area type="monotone" dataKey="passRate" name="Pass Rate" unit="%" stroke="#10B981" strokeWidth={2} fill="url(#gEmerald)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 14 }}>
            <Stat label="Avg Pass Rate"  value={`${stats.avgPassRate}%`} />
            <Stat label="Avg Verif Time" value={`${stats.avgVerifHours}h`} sub="to decision" />
          </div>
          <p style={{ color: 'var(--tx-2)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Rejection breakdown</p>
          {REJECTION_REASONS.map(r => (
            <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: r.color }} />
                <span style={{ color: 'var(--tx-2)', fontSize: 11 }}>{r.reason}</span>
              </div>
              <span style={{ color: 'var(--tx-1)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.count}</span>
            </div>
          ))}
        </ChartCard>

        <ChartCard title="Badge & Trust Economy" sub="Badges issued, disputed, and revoked"
          right={<div style={{ display: 'flex', gap: 12 }}><LegendDot color="#6366F1" label="Issued" /><LegendDot color="#F59E0B" label="Disputed" /></div>}>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="l" type="monotone" dataKey="badgesIssued"   name="Issued"   stroke="#6366F1" strokeWidth={2} fill="url(#gIndigo)" dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="badgesDisputed" name="Disputed" stroke="#F59E0B" strokeWidth={2} fill="url(#gAmber)"  dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Stat label="Issued"   value={stats.totalBadgesIssued.toLocaleString()} />
            <Stat label="Disputed" value={stats.totalBadgesDisputed.toLocaleString()} sub={`${stats.disputeRate}% rate`} />
            <Stat label="Revoked"  value={stats.totalBadgesRevoked.toLocaleString()} />
          </div>
        </ChartCard>
      </div>

      {/* ─── Revenue + Support Health ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Revenue Snapshot" sub="NGN revenue trend over the period">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenueNGN" name="Revenue" stroke="#F59E0B" strokeWidth={2} fill="url(#gAmber)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Stat label="Total Revenue" value={fmtM(stats.totalRevenueNGN)} sub="in period" />
            <div style={{ flex: 1, backgroundColor: 'var(--bg-elevated)', borderRadius: 10, padding: '13px 16px' }}>
              <p style={{ color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Subscriptions</p>
              {SUBSCRIPTION_TIERS.map(t => (
                <div key={t.tier} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: t.color }} />
                    <span style={{ color: 'var(--tx-2)', fontSize: 10 }}>{t.tier}</span>
                  </div>
                  <span style={{ color: 'var(--tx-1)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Support & Operational Health" sub="Ticket volume and SLA compliance">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <Defs />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="ticketsOpened" name="Opened" stroke="#F59E0B" strokeWidth={2} fill="url(#gAmber)"   dot={false} />
              <Area type="monotone" dataKey="ticketsClosed" name="Closed" stroke="#10B981" strokeWidth={2} fill="url(#gEmerald)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Stat label="Total Tickets"  value={stats.totalTickets.toLocaleString()} />
            <Stat label="SLA Compliance" value={`${stats.avgSlaCompliance}%`} sub="avg in period" />
            <Stat label="Avg Resolution" value={`${avgResH}h`} />
          </div>
        </ChartCard>
      </div>

      {/* ─── Trust Distribution + Fraud ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Trust Score Distribution" sub="All-time candidate trust score brackets">
          {[
            { label: '90–100', pct: 28, color: '#10B981' },
            { label: '75–89',  pct: 34, color: '#6366F1' },
            { label: '60–74',  pct: 22, color: '#06B6D4' },
            { label: '40–59',  pct: 11, color: '#F59E0B' },
            { label: '<40',    pct:  5, color: '#EF4444' },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: 'var(--tx-2)', fontSize: 11 }}>Score {b.label}</span>
                <span style={{ color: 'var(--tx-1)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{b.pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--bg-elevated)' }}>
                <div style={{ height: '100%', width: `${b.pct}%`, borderRadius: 4, backgroundColor: b.color }} />
              </div>
            </div>
          ))}
        </ChartCard>

        <ChartCard title="Fraud & Security Events" sub="Fraud flags per period · red = spike above 7"
          right={<div style={{ display: 'flex', gap: 14 }}><LegendDot color="#6366F1" label="Normal" /><LegendDot color="#EF4444" label="Spike" /></div>}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="fraudFlags" name="Fraud Flags" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.fraudFlags > 7 ? '#EF4444' : d.fraudFlags > 4 ? '#F59E0B' : '#6366F1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Stat label="Total Flags" value={stats.totalFraudFlags.toLocaleString()} />
            <Stat label="Avg / Day"   value={`${stats.avgFraudPerDay}`} />
            <Stat label="Blocked IPs" value={rawData.reduce((s, d) => s + d.blockedIPs, 0).toLocaleString()} />
          </div>
        </ChartCard>
      </div>

      {/* ─── Period Breakdown Table ──────────────────────────────── */}
      <ChartCard title="Period Breakdown" sub={`Most recent ${tableData.length} of ${chartData.length} data points`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 11, fontFamily: 'var(--font-mono)', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Period','Candidates','Companies','Applications','Pass Rate','Badges','Revenue','Fraud','SLA'].map(h => (
                  <th key={h} style={{ color: 'var(--tx-3)', fontWeight: 700, textAlign: 'left', padding: '8px 14px 8px 0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}>
                  <td style={{ color: 'var(--tx-2)', padding: '8px 14px 8px 0', whiteSpace: 'nowrap' }}>{r.label}</td>
                  <td style={{ color: 'var(--tx-1)', fontWeight: 700, padding: '8px 14px 8px 0' }}>{r.candidates.toLocaleString()}</td>
                  <td style={{ color: 'var(--tx-1)', padding: '8px 14px 8px 0' }}>{r.companies.toLocaleString()}</td>
                  <td style={{ color: 'var(--tx-1)', padding: '8px 14px 8px 0' }}>{r.applications.toLocaleString()}</td>
                  <td style={{ color: r.passRate >= 80 ? '#10B981' : '#F59E0B', fontWeight: 700, padding: '8px 14px 8px 0' }}>{r.passRate}%</td>
                  <td style={{ color: 'var(--tx-1)', padding: '8px 14px 8px 0' }}>{r.badgesIssued.toLocaleString()}</td>
                  <td style={{ color: 'var(--tx-1)', padding: '8px 14px 8px 0' }}>₦{(r.revenueNGN / 1_000_000).toFixed(1)}M</td>
                  <td style={{ color: r.fraudFlags > 7 ? '#EF4444' : 'var(--tx-1)', fontWeight: r.fraudFlags > 7 ? 700 : 400, padding: '8px 14px 8px 0' }}>{r.fraudFlags}</td>
                  <td style={{ color: r.slaCompliance >= 90 ? '#10B981' : '#F59E0B', fontWeight: 700, padding: '8px 14px 8px 0' }}>{r.slaCompliance}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chartData.length > tableLimit && (
          <button onClick={() => setTableLimit(l => l + 30)}
            style={{ marginTop: 14, padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)' }}>
            Load more ({chartData.length - tableLimit} remaining)
          </button>
        )}
      </ChartCard>

      <div style={{ height: 40 }} />
    </div>
  )
}
