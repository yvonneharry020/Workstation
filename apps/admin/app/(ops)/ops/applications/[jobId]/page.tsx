'use client'

import { useState, use } from 'react'
import Link from 'next/link'
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
interface MockCandidate {
  id: string
  name: string
  appliedAt: string
  status: AppStatus
}

const MOCK_CANDIDATES: MockCandidate[] = [
  { id: '1',  name: 'Chukwuemeka Obi',     appliedAt: '2026-06-16T09:32:00Z', status: 'hired' },
  { id: '2',  name: 'Amara Nwosu',          appliedAt: '2026-06-17T14:15:00Z', status: 'interview' },
  { id: '3',  name: 'Tunde Adeyemi',        appliedAt: '2026-06-17T16:45:00Z', status: 'screening' },
  { id: '4',  name: 'Ngozi Eze',            appliedAt: '2026-06-18T08:20:00Z', status: 'offer' },
  { id: '5',  name: 'Fatima Bello',         appliedAt: '2026-06-18T10:55:00Z', status: 'applied' },
  { id: '6',  name: 'Emeka Okafor',         appliedAt: '2026-06-18T13:30:00Z', status: 'applied' },
  { id: '7',  name: 'Adaeze Okonkwo',       appliedAt: '2026-06-19T09:10:00Z', status: 'screening' },
  { id: '8',  name: 'Babatunde Adesanya',   appliedAt: '2026-06-19T11:40:00Z', status: 'interview' },
  { id: '9',  name: 'Chioma Ifeanyi',       appliedAt: '2026-06-19T14:25:00Z', status: 'rejected' },
  { id: '10', name: 'Musa Abdullahi',       appliedAt: '2026-06-20T08:05:00Z', status: 'applied' },
  { id: '11', name: 'Obioma Nwosu',         appliedAt: '2026-06-20T10:15:00Z', status: 'hired' },
  { id: '12', name: 'Aisha Garba',          appliedAt: '2026-06-21T09:00:00Z', status: 'offer' },
  { id: '13', name: 'Kelechi Ude',          appliedAt: '2026-06-21T11:20:00Z', status: 'applied' },
  { id: '14', name: 'Suleiman Ibrahim',     appliedAt: '2026-06-22T08:30:00Z', status: 'screening' },
  { id: '15', name: 'Grace Osei',           appliedAt: '2026-06-22T14:00:00Z', status: 'rejected' },
]

const MOCK_JOB_META: Record<string, { title: string; company: string }> = {
  'job-001': { title: 'Senior React Developer',          company: 'TechHub Nigeria Ltd' },
  'job-002': { title: 'Financial Analyst (Mid-Level)',   company: 'Zenith Finance Group' },
  'job-003': { title: 'Operations Manager',              company: 'Lagos Logistics Co.' },
  'job-004': { title: 'Customer Service Representative', company: 'Prime Staffing Hub' },
  'job-005': { title: 'Data Analyst (Entry Level)',      company: 'Afri-Tech Solutions' },
  'job-006': { title: 'Software QA Engineer',            company: 'TechHub Nigeria Ltd' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: AppStatus }) {
  const p = PIPELINE.find(p => p.key === status)
  if (!p) return null
  return (
    <span style={{ color: p.color, backgroundColor: p.bg, border: `1px solid ${p.color}40`, borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', textTransform: 'capitalize' }}>
      {p.label}
    </span>
  )
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JobApplicantsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 900)
  }

  const jobMeta = MOCK_JOB_META[jobId] ?? { title: 'Job Post', company: '' }

  const filtered = MOCK_CANDIDATES.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar
        title={jobMeta.title}
        subtitle={`Applicants — ${jobMeta.company}`}
      />
      <div className="p-6 space-y-5">

        {/* Back link */}
        <Link
          href="/ops/applications"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--tx-3)', textDecoration: 'none', fontWeight: 500 }}
        >
          ← Back to Applications
        </Link>

        {/* Mini pipeline counts */}
        <div className="grid grid-cols-6 gap-3">
          {PIPELINE.map(p => {
            const cnt = MOCK_CANDIDATES.filter(c => c.status === p.key).length
            return (
              <div
                key={p.key}
                style={{ ...CARD, padding: '14px 16px', cursor: 'pointer' }}
                className="flex flex-col gap-1"
                onClick={() => setStatusFilter(statusFilter === p.key ? 'all' : p.key)}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{p.label}</span>
                <p className="text-[22px] font-bold font-display" style={{ color: p.color }}>{cnt}</p>
              </div>
            )
          })}
        </div>

        {/* Search + status filter + refresh */}
        <div style={CARD} className="p-4 flex items-center gap-4 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by candidate name…"
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
                {s === 'all' ? 'All' : s}
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

        {/* Candidates table */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
              Candidates ({filtered.length})
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>No candidates match your filter</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Candidate Name', 'Date & Time Applied', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3 text-[11px]" style={{ color: 'var(--tx-3)' }}>{i + 1}</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--tx-1)' }}>{c.name}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>{fmtDateTime(c.appliedAt)}</td>
                    <td className="px-5 py-3"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
