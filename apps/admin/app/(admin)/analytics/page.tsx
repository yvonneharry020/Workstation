'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_STATS, MOCK_REGISTRATION_TREND } from '@/lib/mock-data'

const VERIFICATION_PASS_RATES = [72, 68, 74, 81, 79, 83]
const FRAUD_FLAG_RATES = [4.2, 3.8, 5.1, 3.4, 4.9, 3.1]
const APP_VOLUMES = [312, 287, 341, 398, 421, 519]

function AreaChart({
  data,
  color,
  label,
  unit = '',
}: {
  data: number[]
  color: string
  label: string
  unit?: string
}) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 280
  const H = 60
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 8) - 4
    return { x, y }
  })
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${pts[0].x},${pts[0].y} ${pts.map((p) => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`

  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs text-text-secondary">{label}</p>
          <p className="text-2xl font-mono font-bold text-text-primary mt-0.5">
            {data[data.length - 1]}{unit}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono">
          {data[data.length - 1] > data[data.length - 2] ? (
            <span className="text-trust-high">▲ {Math.abs(data[data.length - 1] - data[data.length - 2]).toFixed(1)}{unit}</span>
          ) : (
            <span className="text-trust-low">▼ {Math.abs(data[data.length - 1] - data[data.length - 2]).toFixed(1)}{unit}</span>
          )}
        </div>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${label})`} />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
      </svg>
      <div className="flex justify-between mt-1">
        {MOCK_REGISTRATION_TREND.map((r) => (
          <span key={r.date} className="text-[9px] text-text-muted font-mono">{r.date.split(' ')[0]}</span>
        ))}
      </div>
    </div>
  )
}

function BigStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-5">
      <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-3xl font-mono font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('7d')

  const handleExport = () => {
    const csv = [
      ['Date', 'Candidates', 'Companies', 'Verif Pass Rate (%)', 'Fraud Flag Rate (%)', 'Applications'],
      ...MOCK_REGISTRATION_TREND.map((r, i) => [
        r.date,
        r.candidates,
        r.companies,
        VERIFICATION_PASS_RATES[i],
        FRAUD_FLAG_RATES[i],
        APP_VOLUMES[i],
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workstation-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Platform Analytics"
        subtitle="Registration trends, verification pass rates, and fraud detection metrics"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-elevated rounded-lg border border-surface-border overflow-hidden">
              {['7d', '14d', '30d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    dateRange === r ? 'bg-admin-500 text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <BigStat label="Total Candidates" value={MOCK_STATS.totalCandidates.toLocaleString()} sub="All-time" />
          <BigStat label="Total Companies" value={MOCK_STATS.totalCompanies.toLocaleString()} sub="All-time" />
          <BigStat label="Avg Pass Rate" value={`${Math.round(VERIFICATION_PASS_RATES.reduce((a, b) => a + b) / VERIFICATION_PASS_RATES.length)}%`} sub="Verification success" color="text-teal-500" />
          <BigStat label="Avg Fraud Flag Rate" value={`${(FRAUD_FLAG_RATES.reduce((a, b) => a + b) / FRAUD_FLAG_RATES.length).toFixed(1)}%`} sub="AI-flagged submissions" color="text-error" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AreaChart data={MOCK_REGISTRATION_TREND.map((r) => r.candidates)} color="#A855F7" label="Candidate Registrations" />
          <AreaChart data={MOCK_REGISTRATION_TREND.map((r) => r.companies)} color="#0DD4C3" label="Company Registrations" />
          <AreaChart data={APP_VOLUMES} color="#FF6240" label="Applications Submitted" />
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AreaChart data={VERIFICATION_PASS_RATES} color="#22C55E" label="Verification Pass Rate" unit="%" />
          <AreaChart data={FRAUD_FLAG_RATES} color="#EF4444" label="Fraud Flag Rate" unit="%" />
        </div>

        {/* Data table */}
        <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-text-primary">Period Breakdown</h3>
          </div>
          <table>
            <thead>
              <tr className="border-b border-surface-border">
                {['Date', 'Candidates', 'Companies', 'Verif Pass', 'Fraud Rate', 'Applications'].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_REGISTRATION_TREND.map((row, i) => (
                <tr key={row.date} className="border-b border-surface-border/50 last:border-0 hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-5 py-3 text-xs font-mono text-text-secondary">{row.date}</td>
                  <td className="px-5 py-3 text-xs font-mono text-admin-300">{row.candidates}</td>
                  <td className="px-5 py-3 text-xs font-mono text-teal-400">{row.companies}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-mono font-bold ${VERIFICATION_PASS_RATES[i] >= 75 ? 'text-trust-high' : 'text-trust-mid'}`}>
                      {VERIFICATION_PASS_RATES[i]}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-mono font-bold ${FRAUD_FLAG_RATES[i] >= 4 ? 'text-trust-low' : 'text-text-secondary'}`}>
                      {FRAUD_FLAG_RATES[i]}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-text-secondary">{APP_VOLUMES[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
