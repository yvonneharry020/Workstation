'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'

type AppStatus = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

const PIPELINE: { key: AppStatus; label: string; color: string; bg: string }[] = [
  { key: 'applied',   label: 'Applied',   color: '#818CF8', bg: 'rgba(99,102,241,0.1)' },
  { key: 'screening', label: 'Screening', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
  { key: 'interview', label: 'Interview', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  { key: 'offer',     label: 'Offer',     color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  { key: 'hired',     label: 'Hired',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  { key: 'rejected',  label: 'Rejected',  color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
]

// ── Mock data ─────────────────────────────────────────────────────────────────
interface MockJob {
  id: string
  title: string
  companyName: string
  employmentType: string
  workMode: string
  city: string
  totalApplicants: number
  statusCounts: Record<AppStatus, number>
  postedAt: string
}

const MOCK_JOBS: MockJob[] = [
  {
    id: 'job-001',
    title: 'Senior React Developer',
    companyName: 'TechHub Nigeria Ltd',
    employmentType: 'Full-time',
    workMode: 'Remote',
    city: 'Lagos',
    totalApplicants: 47,
    statusCounts: { applied: 20, screening: 12, interview: 8, offer: 4, hired: 2, rejected: 1 },
    postedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'job-002',
    title: 'Financial Analyst (Mid-Level)',
    companyName: 'Zenith Finance Group',
    employmentType: 'Full-time',
    workMode: 'On-site',
    city: 'Abuja',
    totalApplicants: 23,
    statusCounts: { applied: 10, screening: 7, interview: 3, offer: 2, hired: 1, rejected: 0 },
    postedAt: '2026-06-20T11:30:00Z',
  },
  {
    id: 'job-003',
    title: 'Operations Manager',
    companyName: 'Lagos Logistics Co.',
    employmentType: 'Full-time',
    workMode: 'On-site',
    city: 'Lagos',
    totalApplicants: 89,
    statusCounts: { applied: 40, screening: 25, interview: 14, offer: 6, hired: 3, rejected: 1 },
    postedAt: '2026-06-10T08:00:00Z',
  },
  {
    id: 'job-004',
    title: 'Customer Service Representative',
    companyName: 'Prime Staffing Hub',
    employmentType: 'Part-time',
    workMode: 'Remote',
    city: 'Kano',
    totalApplicants: 156,
    statusCounts: { applied: 80, screening: 45, interview: 20, offer: 8, hired: 2, rejected: 1 },
    postedAt: '2026-06-25T13:00:00Z',
  },
  {
    id: 'job-005',
    title: 'Data Analyst (Entry Level)',
    companyName: 'Afri-Tech Solutions',
    employmentType: 'Contract',
    workMode: 'Hybrid',
    city: 'Port Harcourt',
    totalApplicants: 34,
    statusCounts: { applied: 15, screening: 10, interview: 6, offer: 2, hired: 1, rejected: 0 },
    postedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'job-006',
    title: 'Software QA Engineer',
    companyName: 'TechHub Nigeria Ltd',
    employmentType: 'Full-time',
    workMode: 'Hybrid',
    city: 'Lagos',
    totalApplicants: 31,
    statusCounts: { applied: 14, screening: 9, interview: 5, offer: 2, hired: 1, rejected: 0 },
    postedAt: '2026-07-02T08:30:00Z',
  },
  {
    id: 'job-007',
    title: 'Logistics Coordinator',
    companyName: 'Prime Staffing Hub',
    employmentType: 'Full-time',
    workMode: 'On-site',
    city: 'Lagos',
    totalApplicants: 63,
    statusCounts: { applied: 30, screening: 18, interview: 9, offer: 4, hired: 1, rejected: 1 },
    postedAt: '2026-06-28T10:00:00Z',
  },
  {
    id: 'job-008',
    title: 'Field Sales Agent',
    companyName: 'Prime Staffing Hub',
    employmentType: 'Contract',
    workMode: 'On-site',
    city: 'Abuja',
    totalApplicants: 44,
    statusCounts: { applied: 20, screening: 13, interview: 7, offer: 3, hired: 1, rejected: 0 },
    postedAt: '2026-07-01T14:00:00Z',
  },
]

// ── Company stats derived from MOCK_JOBS ──────────────────────────────────────
// Applications = sum of ALL applicants across every active job for that company.
// Hired        = sum of hired candidates across all those jobs.
// Conversion   = hired ÷ total applications × 100 (grows as candidates reach hired stage).
interface CompanyStat {
  name: string
  activeJobs: number
  totalApplicants: number
  hired: number
}

const COMPANY_STATS: CompanyStat[] = Object.values(
  MOCK_JOBS.reduce((acc, job) => {
    const existing = acc[job.companyName]
    if (existing) {
      existing.activeJobs += 1
      existing.totalApplicants += job.totalApplicants
      existing.hired += job.statusCounts.hired
    } else {
      acc[job.companyName] = {
        name: job.companyName,
        activeJobs: 1,
        totalApplicants: job.totalApplicants,
        hired: job.statusCounts.hired,
      }
    }
    return acc
  }, {} as Record<string, CompanyStat>)
).sort((a, b) => b.totalApplicants - a.totalApplicants)

// ── Helpers ───────────────────────────────────────────────────────────────────
const PIPELINE_TOTALS = MOCK_JOBS.reduce((acc, job) => {
  for (const key of Object.keys(job.statusCounts) as AppStatus[]) {
    acc[key] = (acc[key] ?? 0) + job.statusCounts[key]
  }
  return acc
}, {} as Record<AppStatus, number>)

const GRAND_TOTAL = Object.values(PIPELINE_TOTALS).reduce((sum, v) => sum + v, 0)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [showAllCompanies, setShowAllCompanies] = useState(false)

  const JOBS_PREVIEW = 6
  const COMPANIES_PREVIEW = 3

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 900)
  }

  const filtered = MOCK_JOBS.filter(job => {
    if (search && !job.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && (job.statusCounts[statusFilter] ?? 0) === 0) return false
    return true
  })

  const hired = PIPELINE_TOTALS.hired ?? 0
  const active = GRAND_TOTAL - (PIPELINE_TOTALS.rejected ?? 0)
  const conversionRate = GRAND_TOTAL > 0 ? ((hired / GRAND_TOTAL) * 100).toFixed(1) : '0'

  const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Applications Pipeline" subtitle="ATS overview — track all candidate applications across jobs" />
      <div className="p-6 space-y-6">

        {/* Pipeline Funnel */}
        <div className="grid grid-cols-6 gap-3">
          {PIPELINE.map((p, idx) => {
            const cnt = PIPELINE_TOTALS[p.key] ?? 0
            const pct = GRAND_TOTAL > 0 ? Math.round((cnt / GRAND_TOTAL) * 100) : 0
            return (
              <div key={p.key} style={CARD} className="p-4 flex flex-col gap-2 cursor-pointer"
                onClick={() => setStatusFilter(statusFilter === p.key ? 'all' : p.key)}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{p.label}</span>
                  {idx < PIPELINE.length - 1 && <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>→</span>}
                </div>
                <p className="text-[24px] font-bold font-display" style={{ color: p.color }}>{cnt}</p>
                <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{pct}% of total</p>
                <div style={{ height: 3, borderRadius: 99, backgroundColor: 'var(--border)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: p.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Applications', value: GRAND_TOTAL },
            { label: 'Active Pipelines',   value: active },
            { label: 'Conversion Rate',    value: `${conversionRate}%` },
            { label: 'Hired',              value: hired },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
              <p className="text-[26px] font-bold font-display" style={{ color: 'var(--tx-1)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + status filter + refresh */}
        <div style={CARD} className="p-5 flex items-center gap-4 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by job title…"
            style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', ...PIPELINE.map(p => p.key)] as (AppStatus | 'all')[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', textTransform: 'capitalize',
                  border: `1px solid ${statusFilter === s ? '#F59E0B' : 'var(--border)'}`,
                  backgroundColor: statusFilter === s ? 'rgba(245,158,11,0.12)' : 'var(--bg-base)',
                  color: statusFilter === s ? '#F59E0B' : 'var(--tx-3)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: refreshing ? 'default' : 'pointer',
              border: '1px solid var(--border)',
              backgroundColor: refreshing ? 'rgba(99,102,241,0.1)' : 'var(--bg-base)',
              color: refreshing ? '#818CF8' : 'var(--tx-3)',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none', fontSize: '14px' }}>↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {/* Applications — compact list */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
              Applications <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>({filtered.length} live job{filtered.length !== 1 ? 's' : ''})</span>
            </p>
            {filtered.length > JOBS_PREVIEW && (
              <button
                onClick={() => setShowAllJobs(v => !v)}
                style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                {showAllJobs ? 'Show Less ↑' : `View All (${filtered.length}) ↓`}
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>No job posts match your filter</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Job / Company', 'Tags', 'Applicants', 'Pipeline', 'Posted', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAllJobs ? filtered : filtered.slice(0, JOBS_PREVIEW)).map((job, i) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/ops/applications/${job.id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--bg-base)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent' }}
                  >
                    <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--tx-3)', width: '36px' }}>{i + 1}</td>
                    <td className="px-4 py-3" style={{ minWidth: '180px' }}>
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>{job.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{job.companyName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[job.employmentType, job.workMode, job.city].map(tag => (
                          <span key={tag} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: '#818CF8', padding: '3px 9px', whiteSpace: 'nowrap' }}>
                        {job.totalApplicants.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {PIPELINE.slice(0, 5).map(p => (
                          <div key={p.key} className="text-center" style={{ minWidth: '28px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: p.color, lineHeight: 1 }}>{job.statusCounts[p.key]}</p>
                            <p style={{ fontSize: '9px', color: 'var(--tx-3)', textTransform: 'uppercase', marginTop: '2px' }}>{p.label.slice(0, 4)}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{fmtDate(job.postedAt)}</td>
                    <td className="px-4 py-3 text-right" style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B' }}>View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Applications by Company */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
              Applications by Company <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>({COMPANY_STATS.length})</span>
            </p>
            {COMPANY_STATS.length > COMPANIES_PREVIEW && (
              <button
                onClick={() => setShowAllCompanies(v => !v)}
                style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                {showAllCompanies ? 'Show Less ↑' : `View All (${COMPANY_STATS.length}) ↓`}
              </button>
            )}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Active Jobs', 'Applications', 'Hired', 'Conversion'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(showAllCompanies ? COMPANY_STATS : COMPANY_STATS.slice(0, COMPANIES_PREVIEW)).map((c, i, arr) => {
                const conv = c.totalApplicants > 0
                  ? ((c.hired / c.totalApplicants) * 100).toFixed(1)
                  : '0.0'
                return (
                  <tr key={c.name} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--tx-1)' }}>{c.name}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-1)' }}>{c.activeJobs}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-1)' }}>{c.totalApplicants.toLocaleString()}</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: '#22C55E' }}>{c.hired}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>{conv}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
