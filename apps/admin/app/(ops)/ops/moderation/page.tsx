'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient } from '@/lib/supabase/tab-client'

type FlagStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned'

interface JobData {
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
  actionNote?: string
  job: JobData
}

// ── DB row shapes ─────────────────────────────────────────────────────────────
interface DbFlag {
  id: string
  flag_reason: string
  status: string
  action_taken: string | null
  created_at: string
  flagged_by: string | null
  content_id: string
}

interface DbJob {
  id: string
  title: string | null
  employment_type: string | null
  work_mode: string | null
  experience_level: string | null
  city: string | null
  description: string | null
  requirements: string | null
  benefits: string | null
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  application_deadline: string | null
  company_id: string
}

interface DbCandidate {
  id: string
  first_name: string | null
  last_name: string | null
}

interface DbCompany {
  id: string
  company_name: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const REASON_COLORS: Record<string, string> = {
  'Suspected scam':                     'bg-red-900/20 text-red-400 border-red-800/30',
  'Job post seems sketchy':             'bg-orange-900/20 text-orange-400 border-orange-800/30',
  'Company asking ridiculous questions': 'bg-amber-900/20 text-amber-400 border-amber-800/30',
  'Misleading job description':         'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  'Inappropriate content':              'bg-purple-900/20 text-purple-400 border-purple-800/30',
  'Duplicate or spam posting':          'bg-blue-900/20 text-blue-400 border-blue-800/30',
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

function mergeReports(
  flags: DbFlag[],
  jobs: DbJob[],
  candidates: DbCandidate[],
  companies: DbCompany[],
): FlagReport[] {
  const jobMap      = new Map(jobs.map(j => [j.id, j]))
  const candidateMap = new Map(candidates.map(c => [c.id, c]))
  const companyMap  = new Map(companies.map(c => [c.id, c]))

  return flags.map(flag => {
    const job      = jobMap.get(flag.content_id)
    const candidate = candidateMap.get(flag.flagged_by ?? '')
    const company  = job ? companyMap.get(job.company_id) : undefined

    const fullName = candidate
      ? `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim()
      : ''

    return {
      id:            flag.id,
      reason:        flag.flag_reason,
      candidateName: fullName || 'Unknown',
      companyName:   company?.company_name ?? 'Unknown Company',
      reportedAt:    flag.created_at,
      status:        flag.status as FlagStatus,
      actionNote:    flag.action_taken ?? undefined,
      job: {
        title:              job?.title             ?? 'Unknown Job',
        employmentType:     job?.employment_type   ?? '',
        workMode:           job?.work_mode         ?? '',
        experienceLevel:    job?.experience_level  ?? '',
        city:               job?.city              ?? '',
        description:        job?.description       ?? '',
        requirements:       job?.requirements      ?? '',
        benefits:           job?.benefits          ?? '',
        salaryMin:          job?.salary_min        ?? null,
        salaryMax:          job?.salary_max        ?? null,
        salaryConfidential: job?.salary_is_confidential ?? false,
        deadline:           job?.application_deadline   ?? null,
      },
    }
  })
}

// ── Action note modal ─────────────────────────────────────────────────────────
function ActionNoteModal({
  report,
  onConfirm,
  onCancel,
}: {
  report: FlagReport
  onConfirm: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-base font-semibold font-display text-text-primary mb-1">Record Action Taken</h2>
        <p className="text-xs text-text-muted mb-4">
          Describe the action taken against{' '}
          <span className="text-text-primary font-medium">{report.companyName}</span>{' '}
          for the {'"'}{report.reason}{'"'} report. This note will be visible to all staff members.
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. We closed the job posting immediately and sent a formal warning to the company. The account has been flagged for monitoring."
          autoFocus
          className="w-full h-32 px-3 py-2.5 text-sm bg-surface-elevated border border-surface-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ops-500 resize-none transition-colors"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border text-text-muted rounded-lg hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (note.trim()) onConfirm(note.trim()) }}
            disabled={!note.trim()}
            className="flex-1 px-4 py-2 text-xs font-semibold bg-green-900/30 border border-green-800/40 text-green-400 rounded-lg hover:bg-green-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save &amp; Mark Actioned
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Job post modal ────────────────────────────────────────────────────────────
function JobModal({ report, onClose }: { report: FlagReport; onClose: () => void }) {
  const { job } = report
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
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

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Salary</p>
              <p className="text-sm text-text-primary">{formatSalary(job.salaryMin, job.salaryMax, job.salaryConfidential)}</p>
            </div>
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Application Deadline</p>
              <p className="text-sm text-text-primary">
                {job.deadline
                  ? new Date(job.deadline).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })
                  : 'No deadline set'}
              </p>
            </div>
          </div>

          {job.description && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Job Description</p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.requirements && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Requirements</p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{job.requirements}</p>
            </div>
          )}

          {job.benefits && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Benefits</p>
              <p className="text-sm text-text-secondary leading-relaxed">{job.benefits}</p>
            </div>
          )}

          <div className="bg-red-900/10 border border-red-800/20 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Report Details</p>
            <p className="text-xs text-text-secondary">
              <span className="text-text-primary font-medium">{report.candidateName}</span> reported this job for:{' '}
              <span className="text-red-400 font-semibold">{'"'}{report.reason}{'"'}</span>
            </p>
            <p className="text-xs text-text-muted mt-0.5">Reported on {formatDateTime(report.reportedAt)}</p>
          </div>

          {report.actionNote && (
            <div className="bg-green-900/10 border border-green-800/20 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">Action Taken</p>
              <p className="text-xs text-text-secondary leading-relaxed">{report.actionNote}</p>
            </div>
          )}
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
  const [reports, setReports]     = useState<FlagReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('pending')
  const [search, setSearch]       = useState('')
  const [viewing, setViewing]     = useState<string | null>(null)
  const [actioning, setActioning] = useState<FlagReport | null>(null)

  const fetchReports = useCallback(async () => {
    const supabase = createTabClient()

    const { data: flags, error } = await supabase
      .from('flagged_content')
      .select('id, flag_reason, status, action_taken, created_at, flagged_by, content_id')
      .eq('content_type', 'job_posting')
      .order('created_at', { ascending: false })

    if (error || !flags?.length) {
      setReports([])
      setLoading(false)
      return
    }

    const jobIds       = [...new Set(flags.map(f => f.content_id as string))]
    const candidateIds = [...new Set(flags.map(f => f.flagged_by as string | null).filter((id): id is string => id !== null))]

    const [{ data: jobs }, { data: candidates }] = await Promise.all([
      supabase
        .from('job_postings')
        .select('id, title, employment_type, work_mode, experience_level, city, description, requirements, benefits, salary_min, salary_max, salary_is_confidential, application_deadline, company_id')
        .in('id', jobIds),
      supabase
        .from('candidate_profiles')
        .select('id, first_name, last_name')
        .in('id', candidateIds),
    ])

    const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id).filter(Boolean))]
    const { data: companies } = await supabase
      .from('company_profiles')
      .select('id, company_name')
      .in('id', companyIds)

    setReports(mergeReports(
      flags as DbFlag[],
      (jobs ?? []) as DbJob[],
      (candidates ?? []) as DbCandidate[],
      (companies ?? []) as DbCompany[],
    ))
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchReports()

    const supabase = createTabClient()
    const channel = supabase
      .channel('flagged-content-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flagged_content' }, () => void fetchReports())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [fetchReports])

  async function markReviewed(id: string) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'reviewed' as FlagStatus } : r))
    const supabase = createTabClient()
    await supabase.from('flagged_content').update({ status: 'reviewed' }).eq('id', id)
  }

  async function markDismissed(id: string) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' as FlagStatus } : r))
    const supabase = createTabClient()
    await supabase.from('flagged_content').update({ status: 'dismissed' }).eq('id', id)
  }

  async function markActioned(id: string, note: string) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'actioned' as FlagStatus, actionNote: note } : r))
    setActioning(null)
    const supabase = createTabClient()
    await supabase.from('flagged_content').update({ status: 'actioned', action_taken: note }).eq('id', id)
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length

  const byFilter = filter === 'all' ? reports : reports.filter(r => r.status === filter)

  const filtered = search.trim()
    ? byFilter.filter(r => r.candidateName.toLowerCase().includes(search.trim().toLowerCase()))
    : byFilter

  const viewingReport = viewing ? (reports.find(r => r.id === viewing) ?? null) : null

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold font-display text-text-primary">Flagged Content</h1>
          <p className="text-sm text-text-muted mt-1">Job reports submitted by candidates. Review the post and take action.</p>
        </div>
        <div className="space-y-3 max-w-3xl">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-card border border-surface-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

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

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by candidate name..."
          className="w-full pl-8 pr-3 py-2 text-sm bg-surface-card border border-surface-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ops-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-surface-border pb-2">
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'all' ? reports.length : reports.filter(r => r.status === tab.key).length
          return (
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
              <span className={`ml-1.5 text-[10px] font-bold ${tab.key === 'pending' && count > 0 ? 'text-red-400' : 'text-text-muted font-normal'}`}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">
            {search.trim()
              ? `No results for "${search}".`
              : `No ${filter === 'all' ? '' : filter} reports.`}
          </p>
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${reasonColor}`}>
                        <FlagIcon />
                        {report.reason}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${STATUS_PILL[report.status]}`}>
                        {report.status}
                      </span>
                    </div>

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
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Date &amp; Time</span>
                        <span className="text-xs text-text-muted">{formatDateTime(report.reportedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-24">Job Post</span>
                        <span className="text-sm text-text-secondary italic">{'"'}{report.job.title}{'"'}</span>
                      </div>
                    </div>

                    {report.status === 'actioned' && report.actionNote && (
                      <div className="mt-3 bg-green-900/10 border border-green-800/20 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">Action Taken</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{report.actionNote}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => setViewing(report.id)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-ops-900/30 border border-ops-800/40 text-ops-300 rounded-lg hover:bg-ops-900/50 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      View Job Post
                    </button>

                    {report.status === 'pending' && (
                      <button
                        onClick={() => markReviewed(report.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-900/20 border border-amber-800/30 text-amber-400 rounded-lg hover:bg-amber-900/40 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        Review
                      </button>
                    )}

                    {report.status === 'reviewed' && (
                      <>
                        <button
                          onClick={() => markDismissed(report.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border text-text-muted rounded-lg hover:text-text-primary hover:border-surface-card transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                          Dismiss
                        </button>
                        <button
                          onClick={() => setActioning(report)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-green-900/20 border border-green-800/30 text-green-400 rounded-lg hover:bg-green-900/40 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Action
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewingReport && (
        <JobModal
          report={viewingReport}
          onClose={() => setViewing(null)}
        />
      )}

      {actioning && (
        <ActionNoteModal
          report={actioning}
          onConfirm={note => markActioned(actioning.id, note)}
          onCancel={() => setActioning(null)}
        />
      )}
    </div>
  )
}
