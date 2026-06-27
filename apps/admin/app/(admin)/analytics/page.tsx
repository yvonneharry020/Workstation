'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, AreaChart, BarChart,
  Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Building2,
  Shield, AlertTriangle, Download, Activity,
} from 'lucide-react'

// ─── 30-day platform data ──────────────────────────────────────────
const FULL_DATA = [
  { date: 'Jun 1',  candidates: 42,  companies: 6,  applications: 278, passRate: 72, fraudFlags: 3, activeUsers: 847  },
  { date: 'Jun 2',  candidates: 38,  companies: 5,  applications: 241, passRate: 74, fraudFlags: 2, activeUsers: 792  },
  { date: 'Jun 3',  candidates: 55,  companies: 8,  applications: 312, passRate: 71, fraudFlags: 4, activeUsers: 901  },
  { date: 'Jun 4',  candidates: 67,  companies: 9,  applications: 340, passRate: 75, fraudFlags: 3, activeUsers: 956  },
  { date: 'Jun 5',  candidates: 72,  companies: 11, applications: 361, passRate: 78, fraudFlags: 5, activeUsers: 1024 },
  { date: 'Jun 6',  candidates: 61,  companies: 10, applications: 290, passRate: 73, fraudFlags: 2, activeUsers: 978  },
  { date: 'Jun 7',  candidates: 48,  companies: 7,  applications: 215, passRate: 80, fraudFlags: 1, activeUsers: 834  },
  { date: 'Jun 8',  candidates: 59,  companies: 9,  applications: 305, passRate: 76, fraudFlags: 3, activeUsers: 912  },
  { date: 'Jun 9',  candidates: 71,  companies: 12, applications: 378, passRate: 79, fraudFlags: 4, activeUsers: 1045 },
  { date: 'Jun 10', candidates: 83,  companies: 14, applications: 421, passRate: 82, fraudFlags: 2, activeUsers: 1121 },
  { date: 'Jun 11', candidates: 92,  companies: 15, applications: 456, passRate: 81, fraudFlags: 6, activeUsers: 1198 },
  { date: 'Jun 12', candidates: 78,  companies: 13, applications: 394, passRate: 77, fraudFlags: 3, activeUsers: 1087 },
  { date: 'Jun 13', candidates: 65,  companies: 10, applications: 319, passRate: 74, fraudFlags: 2, activeUsers: 987  },
  { date: 'Jun 14', candidates: 54,  companies: 8,  applications: 267, passRate: 79, fraudFlags: 1, activeUsers: 893  },
  { date: 'Jun 15', candidates: 89,  companies: 15, applications: 462, passRate: 83, fraudFlags: 4, activeUsers: 1234 },
  { date: 'Jun 16', candidates: 104, companies: 18, applications: 498, passRate: 85, fraudFlags: 3, activeUsers: 1312 },
  { date: 'Jun 17', candidates: 117, companies: 20, applications: 541, passRate: 84, fraudFlags: 5, activeUsers: 1401 },
  { date: 'Jun 18', candidates: 98,  companies: 17, applications: 487, passRate: 82, fraudFlags: 4, activeUsers: 1289 },
  { date: 'Jun 19', candidates: 86,  companies: 14, applications: 413, passRate: 80, fraudFlags: 2, activeUsers: 1178 },
  { date: 'Jun 20', candidates: 134, companies: 22, applications: 612, passRate: 87, fraudFlags: 7, activeUsers: 1567 },
  { date: 'Jun 21', candidates: 121, companies: 19, applications: 578, passRate: 85, fraudFlags: 5, activeUsers: 1489 },
  { date: 'Jun 22', candidates: 108, companies: 17, applications: 521, passRate: 83, fraudFlags: 3, activeUsers: 1398 },
  { date: 'Jun 23', candidates: 91,  companies: 15, applications: 442, passRate: 81, fraudFlags: 4, activeUsers: 1267 },
  { date: 'Jun 24', candidates: 115, companies: 19, applications: 537, passRate: 84, fraudFlags: 6, activeUsers: 1445 },
  { date: 'Jun 25', candidates: 129, companies: 21, applications: 589, passRate: 86, fraudFlags: 4, activeUsers: 1523 },
  { date: 'Jun 26', candidates: 97,  companies: 16, applications: 461, passRate: 82, fraudFlags: 3, activeUsers: 1312 },
  { date: 'Jun 27', candidates: 143, companies: 24, applications: 634, passRate: 88, fraudFlags: 5, activeUsers: 1634 },
  { date: 'Jun 28', candidates: 138, companies: 23, applications: 618, passRate: 87, fraudFlags: 4, activeUsers: 1598 },
  { date: 'Jun 29', candidates: 152, companies: 26, applications: 671, passRate: 89, fraudFlags: 3, activeUsers: 1723 },
  { date: 'Jun 30', candidates: 167, companies: 28, applications: 712, passRate: 91, fraudFlags: 2, activeUsers: 1842 },
]

const TRUST_BUCKETS = [
  { range: '81–100', label: 'Excellent', count: 514, color: '#10B981' },
  { range: '61–80',  label: 'Good',      count: 778, color: '#6366F1' },
  { range: '41–60',  label: 'Moderate',  count: 349, color: '#F59E0B' },
  { range: '21–40',  label: 'Low',       count: 147, color: '#EF4444' },
  { range: '0–20',   label: 'Critical',  count: 54,  color: '#991B1B' },
]
const TRUST_TOTAL = TRUST_BUCKETS.reduce((s, b) => s + b.count, 0)

const VERIF_FUNNEL = [
  { stage: 'Submitted',  count: 1842, pct: 100   },
  { stage: 'NIN Verified', count: 1654, pct: 89.8 },
  { stage: 'Liveness',   count: 1428, pct: 77.5 },
  { stage: 'Docs Passed',count: 1289, pct: 70.0 },
  { stage: 'Approved',   count: 1164, pct: 63.2 },
]

const RANGES = { '7D': 7, '30D': 30 } as const
type Range = keyof typeof RANGES

// ─── Shared axis tick style — SVG supports CSS vars ───────────────
const TICK = { fill: 'var(--tx-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }

// ─── Custom tooltip ───────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: 'var(--shadow-md)',
      minWidth: 148,
    }}>
      <p style={{ color: 'var(--tx-3)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--tx-2)', fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: 'var(--tx-1)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{p.unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────
function KpiCard({ label, value, delta, sub, Icon, color }: {
  label: string; value: string; delta: number; sub: string
  Icon: React.ElementType; color: string
}) {
  const up = delta >= 0
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: 'var(--tx-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <p style={{ color: 'var(--tx-1)', fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {up ? <TrendingUp size={11} color="#10B981" /> : <TrendingDown size={11} color="#EF4444" />}
        <span style={{ color: up ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {up ? '+' : ''}{delta.toFixed(1)}%
        </span>
        <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{sub}</span>
      </div>
    </div>
  )
}

// ─── Chart section wrapper ─────────────────────────────────────────
function ChartCard({ title, sub, children, right }: {
  title: string; sub: string; children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '24px 24px 16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--tx-1)', fontSize: 13, fontWeight: 600 }}>{title}</h2>
          <p style={{ color: 'var(--tx-3)', fontSize: 11, marginTop: 3 }}>{sub}</p>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── Legend dot ───────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: color }} />
      <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30D')

  const data = useMemo(() => FULL_DATA.slice(-RANGES[range]), [range])

  const totals = useMemo(() => {
    const candidates  = data.reduce((s, d) => s + d.candidates, 0)
    const companies   = data.reduce((s, d) => s + d.companies, 0)
    const applications = data.reduce((s, d) => s + d.applications, 0)
    const avgPass     = data.reduce((s, d) => s + d.passRate, 0) / data.length
    const avgFraud    = data.reduce((s, d) => s + d.fraudFlags, 0) / data.length
    const totalFlags  = data.reduce((s, d) => s + d.fraudFlags, 0)
    return { candidates, companies, applications, avgPass, avgFraud, totalFlags }
  }, [data])

  const handleExport = () => {
    const rows = [
      ['Date', 'Candidates', 'Companies', 'Applications', 'Pass Rate (%)', 'Fraud Flags', 'Active Users'],
      ...data.map(r => [r.date, r.candidates, r.companies, r.applications, r.passRate, r.fraudFlags, r.activeUsers]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `analytics-${range.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
  }

  const tickInterval = Math.floor(data.length / 6)

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 backdrop-blur-sm border-b flex items-center justify-between px-8 py-4"
        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)' }}
      >
        <div>
          <h1 style={{ color: 'var(--tx-1)', fontSize: 18, fontWeight: 600 }}>Platform Analytics</h1>
          <p style={{ color: 'var(--tx-2)', fontSize: 12, marginTop: 2 }}>
            Growth, verification health &amp; platform trust — live interactive charts
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(Object.keys(RANGES) as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: range === r ? '#6366F1' : 'var(--bg-card)',
                  color: range === r ? '#fff' : 'var(--tx-2)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              fontSize: 11, fontWeight: 600, borderRadius: 8,
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--tx-2)', cursor: 'pointer',
            }}
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Candidates"
            value={totals.candidates.toLocaleString()}
            delta={12.4} sub="vs prev period"
            Icon={Users} color="#6366F1"
          />
          <KpiCard
            label="Companies"
            value={totals.companies.toLocaleString()}
            delta={8.7} sub="vs prev period"
            Icon={Building2} color="#06B6D4"
          />
          <KpiCard
            label="Avg Pass Rate"
            value={`${totals.avgPass.toFixed(1)}%`}
            delta={3.2} sub="vs prev period"
            Icon={Shield} color="#10B981"
          />
          <KpiCard
            label="Fraud / Day"
            value={totals.avgFraud.toFixed(1)}
            delta={-14.3} sub="vs prev period"
            Icon={AlertTriangle} color="#EF4444"
          />
        </div>

        {/* ── Main chart: User Growth ── */}
        <ChartCard
          title="User Growth"
          sub="Daily candidate and company registrations — hover any point for full detail"
          right={
            <div style={{ display: 'flex', gap: 16 }}>
              <LegendDot color="#6366F1" label="Candidates" />
              <LegendDot color="#10B981" label="Companies" />
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gCandidates" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gCompanies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="candidates" name="Candidates"
                fill="url(#gCandidates)" stroke="#6366F1" strokeWidth={2}
                dot={false} activeDot={{ r: 5, fill: '#6366F1', strokeWidth: 0 }}
              />
              <Area
                type="monotone" dataKey="companies" name="Companies"
                fill="url(#gCompanies)" stroke="#10B981" strokeWidth={2}
                dot={false} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Row 2: Applications + Pass Rate ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <ChartCard
            title="Daily Applications"
            sub={`${totals.applications.toLocaleString()} submissions in period`}
          >
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="applications" name="Applications"
                  fill="url(#gApps)" stroke="#F59E0B" strokeWidth={2}
                  dot={false} activeDot={{ r: 5, fill: '#F59E0B', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Verification Pass Rate"
            sub="Daily % — reference line shows period average"
          >
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="gPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} domain={[60, 100]} />
                <ReferenceLine
                  y={Math.round(totals.avgPass)}
                  stroke="#6366F1" strokeDasharray="4 3" strokeOpacity={0.5}
                  label={{ value: `avg ${Math.round(totals.avgPass)}%`, fill: '#6366F1', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="passRate" name="Pass Rate" unit="%"
                  fill="url(#gPass)" stroke="#06B6D4" strokeWidth={2}
                  dot={false} activeDot={{ r: 5, fill: '#06B6D4', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Row 3: Trust buckets + Verification funnel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Trust Score Distribution */}
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-card)',
          }}>
            <h2 style={{ color: 'var(--tx-1)', fontSize: 13, fontWeight: 600 }}>Trust Score Distribution</h2>
            <p style={{ color: 'var(--tx-3)', fontSize: 11, marginTop: 3, marginBottom: 22 }}>
              All {TRUST_TOTAL.toLocaleString()} candidates ranked by composite trust score
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TRUST_BUCKETS.map(b => {
                const pct = Math.round((b.count / TRUST_TOTAL) * 100)
                return (
                  <div key={b.range}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: b.color, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 44 }}>{b.range}</span>
                        <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{b.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ color: 'var(--tx-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{b.count.toLocaleString()}</span>
                        <span style={{ color: 'var(--tx-1)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, backgroundColor: 'var(--bg-elevated)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: b.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Verification Funnel */}
          <ChartCard
            title="Verification Funnel"
            sub="Stage-by-stage drop-off — hover each bar for conversion rate"
          >
            <ResponsiveContainer width="100%" height={218}>
              <BarChart
                data={VERIF_FUNNEL}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} domain={[0, 2000]} />
                <YAxis type="category" dataKey="stage" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload as typeof VERIF_FUNNEL[0]
                    return (
                      <div style={{
                        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)',
                        borderRadius: 10, padding: '11px 14px', boxShadow: 'var(--shadow-md)',
                      }}>
                        <p style={{ color: 'var(--tx-3)', fontSize: 11, marginBottom: 6 }}>{label}</p>
                        <p style={{ color: 'var(--tx-1)', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {row.count.toLocaleString()} users
                        </p>
                        <p style={{ color: '#6366F1', fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {row.pct}% of total submitted
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" name="Users" radius={[0, 5, 5, 0]} maxBarSize={24}>
                  {VERIF_FUNNEL.map((_, i) => (
                    <Cell key={i} fill={`rgba(99,102,241,${1 - i * 0.16})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Fraud Detection chart ── */}
        <ChartCard
          title="Fraud Detection Events"
          sub="AI-flagged submissions per day — red spikes indicate active fraud attempts"
          right={
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)',
            }}>
              <AlertTriangle size={12} color="#EF4444" />
              <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>
                {totals.totalFlags} total flags
              </span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <ReferenceLine
                y={Math.round(totals.avgFraud)}
                stroke="rgba(239,68,68,0.4)" strokeDasharray="4 3"
                label={{ value: `avg ${totals.avgFraud.toFixed(1)}`, fill: '#EF4444', fontSize: 9, fontFamily: 'var(--font-mono)' }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="fraudFlags" name="Fraud Flags" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.fraudFlags >= 6 ? '#EF4444' : d.fraudFlags >= 4 ? '#F59E0B' : '#6366F1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <LegendDot color="#EF4444" label="High (≥6)" />
            <LegendDot color="#F59E0B" label="Elevated (4–5)" />
            <LegendDot color="#6366F1" label="Normal (≤3)" />
          </div>
        </ChartCard>

        {/* ── Period Breakdown Table ── */}
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ color: 'var(--tx-1)', fontSize: 13, fontWeight: 600 }}>Period Breakdown</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={12} color="var(--tx-3)" />
              <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{data.length} days shown (newest first)</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Candidates', 'Companies', 'Applications', 'Pass Rate', 'Fraud Flags', 'Active Users'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 20px',
                      fontSize: 10, fontWeight: 700, color: 'var(--tx-3)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row, i, arr) => (
                  <tr
                    key={row.date}
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td style={{ padding: '11px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--tx-2)' }}>{row.date}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6366F1', fontWeight: 600 }}>{row.candidates}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#10B981', fontWeight: 600 }}>{row.companies}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#F59E0B', fontWeight: 600 }}>{row.applications.toLocaleString()}</td>
                    <td style={{ padding: '11px 20px' }}>
                      <span style={{
                        fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: row.passRate >= 85 ? '#10B981' : row.passRate >= 75 ? '#06B6D4' : row.passRate >= 65 ? '#F59E0B' : '#EF4444',
                      }}>
                        {row.passRate}%
                      </span>
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      <span style={{
                        fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: row.fraudFlags >= 6 ? '#EF4444' : row.fraudFlags >= 4 ? '#F59E0B' : 'var(--tx-2)',
                      }}>
                        {row.fraudFlags}
                      </span>
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--tx-2)' }}>{row.activeUsers.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
