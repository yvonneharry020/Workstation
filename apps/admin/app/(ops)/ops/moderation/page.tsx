'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type FlagStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned'

interface MockJob {
  title: string
  employmentType: string
  workMode: string
  experienceLevel: string
  city: string
  description: string
  requirements: string
  benefits: string
  salaryMin: number | null
  salaryMax: number | null
  salaryConfidential: boolean
  deadline: string | null
}

interface FlagReport {
  id: string
  reason: string
  candidateName: string
  companyName: string
  reportedAt: string
  status: FlagStatus
  job: MockJob
}

// ── MOCK DATA (design preview only — will be removed after approval) ──────────
const MOCK_REPORTS: FlagReport[] = [
  {
    id: '1',
    reason: 'Suspected scam',
    candidateName: 'Chukwuemeka Obi',
    companyName: 'TechHub Nigeria Ltd',
    reportedAt: '2026-07-01T14:32:00Z',
    status: 'pending',
    job: {
      title: 'Senior React Developer',
      employmentType: 'Full-time',
      workMode: 'Remote',
      experienceLevel: 'Senior',
      city: 'Lagos',
      description:
        'We are looking for a Senior React Developer to join our rapidly growing team. You will be responsible for building and maintaining high-quality web applications for our clients across Africa.',
      requirements:
        '• 5+ years of experience with React\n• Strong understanding of TypeScript\n• Experience with Next.js and REST APIs\n• Send ₦5,000 registration fee to begin the application process\n• Provide personal bank account details upon application',
      benefits: 'Health insurance, Remote work allowance, Flexible hours, 13th month salary',
      salaryMin: 800000,
      salaryMax: 1200000,
      salaryConfidential: false,
      deadline: '2026-07-31',
    },
  },
  {
    id: '2',
    reason: 'Job post seems sketchy',
    candidateName: 'Amara Nwosu',
    companyName: 'Zenith Finance Group',
    reportedAt: '2026-07-02T09:15:00Z',
    status: 'pending',
    job: {
      title: 'Financial Analyst',
      employmentType: 'Full-time',
      workMode: 'On-site',
      experienceLevel: 'Mid-level',
      city: 'Abuja',
      description:
        'Join our financial team and help analyze market trends. No prior experience necessary. Training is fully self-funded. Must have your own laptop and internet from day one.',
      requirements:
        '• BSc in Finance or any related field\n• Must provide 3 months advance payment guarantee before onboarding\n• Must purchase company equipment kit at ₦15,000 before resumption\n• No criminal record certificate required at your own expense',
      benefits: 'Salary paid after 3-month probation period, Possible renewal',
      salaryMin: null,
      salaryMax: null,
      salaryConfidential: true,
      deadline: '2026-07-20',
    },
  },
  {
    id: '3',
    reason: 'Company asking ridiculous questions',
    candidateName: 'Tunde Adeyemi',
    companyName: 'Lagos Logistics Co.',
    reportedAt: '2026-07-02T11:47:00Z',
    status: 'pending',
    job: {
      title: 'Operations Manager',
      employmentType: 'Full-time',
      workMode: 'On-site',
      experienceLevel: 'Senior',
      city: 'Lagos',
      description:
        'We are hiring an experienced Operations Manager to oversee our logistics chain across Nigeria and West Africa.',
      requirements:
        '• 7+ years in logistics or supply chain management\n• Must share all social media account passwords for background verification\n• Must provide bank statements for the last 12 months before interview\n• Must disclose current and previous salary slips from all employers',
      benefits: 'Competitive salary, Company car, Travel allowance',
      salaryMin: 500000,
      salaryMax: 700000,
      salaryConfidential: false,
      deadline: '2026-08-01',
    },
  },
  {
    id: '4',
    reason: 'Misleading job description',
    candidateName: 'Ngozi Eze',
    companyName: 'Afri-Tech Solutions',
    reportedAt: '2026-06-29T16:00:00Z',
    status: 'reviewed',
    job: {
      title: 'Data Analyst (Entry Level)',
      employmentType: 'Contract',
      workMode: 'Hybrid',
      experienceLevel: 'Entry-level',
      city: 'Port Harcourt',
      description:
        'Entry-level data analyst role. Light Excel work only. Perfect for fresh graduates.',
      requirements:
        '• Must have expert knowledge of Python, R, SQL, Tableau, Power BI, SAS, and Machine Learning frameworks\n• PhD preferred, Masters minimum\n• Minimum 5 years hands-on industry experience required\n• Must complete unpaid 6-month trial before receiving any compensation',
      benefits: 'Monthly stipend (amount TBD after trial)',
      salaryMin: 80000,
      salaryMax: 80000,
      salaryConfidential: false,
      deadline: '2026-07-15',
    },
  },
  {
    id: '5',
    reason: 'Inappropriate content',
    candidateName: 'Fatima Bello',
    companyName: 'Prime Staffing Hub',
    reportedAt: '2026-07-03T08:05:00Z',
    status: 'pending',
    job: {
      title: 'Customer Service Representative',
      employmentType: 'Part-time',
      workMode: 'Remote',
      experienceLevel: 'Entry-level',
      city: 'Kano',
      description:
        'We need young attractive ladies only for our front-facing customer service roles. Age 18–25. Must attach full body photo with application. Married women need not apply.',
      requirements:
        '• Female only\n• Must be single\n• Height minimum 5\'5"\n• Attach recent full-body photograph\n• Must be available to work evenings and weekends with no extra pay',
      benefits: 'Weekly cash payout',
      salaryMin: 40000,
      salaryMax: 40000,
      salaryConfidential: false,
      deadline: '2026-07-10',
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const REASON_COLORS: Record<string, string> = {
  'Suspected scam':                    'bg-red-900/20 text-red-400 border-red-800/30',
  'Job post seems sketchy':            'bg-orange-900/20 text-orange-400 border-orange-800/30',
  'Company asking ridiculous questions':'bg-amber-900/20 text-amber-400 border-amber-800/30',
  'Misleading job description':        'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  'Inappropriate content':             'bg-purple-900/20 text-purple-400 border-purple-800/30',
  'Duplicate or spam posting':         'bg-blue-900/20 text-blue-400 border-blue-800/30',
}

const STATUS_PILL: Record<FlagStatus, string> = {
  pending:   'bg-orange-900/20 text-orange-400 border-orange-800/30',
  reviewed:  'bg-blue-900/20 text-blue-400 border-blue-800/30',
  dismissed: 'bg-gray-900/30 text-gray-400 border-gray-700/30',
  actioned:  'bg-green-900/20 text-green-400 border-green-800/30',
}

const FILTER_TABS: { key: string; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'reviewed',  label: 'Reviewed' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'actioned',  label: 'Actioned' },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatSalary(min: number | null, max: number | null, confidential: boolean) {
  if (confidential) return 'Confidential'
  if (!min && !max) return 'Not disclosed'
  const fmt = (n: number) => `₦${n.toLocaleString()}`
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)} / month`
  return `${fmt(min ?? max!)} / month`
}

// ── Job Post Modal ────────────────────────────────────────────────────────────
function JobModal({ report, onClose }: { report: FlagReport; onClose: () => void }) {
  const { job } = report
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Modal header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-surface-border">
          <div>
            <h2 className="text-base font-semibold font-display text-text-primary">{job.title}</h2>
            <p className="text-sm text-text-muted mt-0.5">{report.companyName}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {[job.employmentType, job.workMode, job.experienceLevel, job.city].filter(Boolean).map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors ml-4 flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {/* Salary + deadline row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Salary</p>
              <p className="text-sm text-text-primary">{formatSalary(job.salaryMin, job.salaryMax, job.salaryConfidential)}</p>
            </div>
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Application Deadline</p>
              <p className="text-sm text-text-primary">
                {job.deadline ? new Date(job.deadline).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }) : 'No deadline set'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Job Description</p>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>

          {/* Requirements */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Requirements</p>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{job.requirements}</p>
          </div>

          {/* Benefits */}
          {job.benefits && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Benefits</p>
              <p className="text-sm text-text-secondary leading-relaxed">{job.benefits}</p>
            </div>
          )}

          {/* Report context */}
          <div className="bg-red-900/10 border border-red-800/20 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Report Details</p>
            <p className="text-xs text-text-secondary">
              <span className="text-text-primary font-medium">{report.candidateName}</span> reported this job for:{' '}
              <span className="text-red-400 font-semibold">"{report.reason}"</span>
            </p>
            <p className="text-xs text-text-muted mt-0.5">Reported on {formatDateTime(report.reportedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Flag icon ─────────────────────────────────────────────────────────────────
function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ModerationPage() {
  const [filter, setFilter] = useState('pending')
  const [viewing, setViewing] = useState<FlagReport | null>(null)

  const filtered = filter === 'all'
    ? MOCK_REPORTS
    : MOCK_REPORTS.filter(r => r.status === filter)

  const pendingCount = MOCK_REPORTS.filter(r => r.status === 'pending').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Flagged Content</h1>
          <p className="text-sm text-text-muted mt-1">
            Job reports submitted by candidates. Review the post and take action.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-red-900/20 text-red-400 border border-red-800/30">
            {pendingCount} pending review
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-surface-border pb-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-ops-900/50 text-ops-300'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && (
              <span className="ml-1.5 text-[10px] font-bold text-red-400">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">No {filter} reports.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-w-3xl">
          {filtered.map(report => {
            const reasonColor = REASON_COLORS[report.reason] ?? 'bg-orange-900/20 text-orange-400 border-orange-800/30'
            return (
              <div
                key={report.id}
                className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-ops-800/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left — report info */}
                  <div className="flex-1 min-w-0">
                    {/* Reason badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${reasonColor}`}>
                        <FlagIcon />
                        {report.reason}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${STATUS_PILL[report.status]}`}>
                        {report.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Reported by</span>
                        <span className="text-sm text-text-primary font-medium">{report.candidateName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Company</span>
                        <span className="text-sm text-text-secondary">{report.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Date & Time</span>
                        <span className="text-xs text-text-muted">{formatDateTime(report.reportedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Job Post</span>
                        <span className="text-sm text-text-secondary italic">"{report.job.title}"</span>
                      </div>
                    </div>
                  </div>

                  {/* Right — View button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setViewing(report)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-ops-900/30 border border-ops-800/40 text-ops-300 rounded-lg hover:bg-ops-900/50 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      View Job Post
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Job post modal */}
      {viewing && <JobModal report={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
