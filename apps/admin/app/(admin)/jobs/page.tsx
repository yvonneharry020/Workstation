'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_JOB_POSTS } from '@/lib/mock-data'

type JobStatus = 'active' | 'flagged' | 'removed'
type JobFilter = 'all' | 'flagged' | 'active'
type JobAction = 'clear' | 'remove' | 'warn' | 'ban_company'

interface Job {
  id: string
  title: string
  company: string
  status: JobStatus
  postedAt: string
  applications: number
  category: string
  flagReason: string | null
  confidence: number | null
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map = {
    active: 'bg-trust-high-bg text-trust-high border-trust-high-border',
    flagged: 'bg-trust-low-bg text-trust-low border-trust-low-border',
    removed: 'bg-surface-muted text-text-muted border-surface-border',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${map[status]}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ActionModal {
  jobId: string
  jobTitle: string
  action: JobAction
}

const ACTION_DETAILS: Record<JobAction, { label: string; desc: string }> = {
  clear: { label: 'Clear Flag', desc: 'Remove the AI flag. The job post will continue to show as active.' },
  remove: { label: 'Remove Post', desc: 'Permanently remove this job post. A notification will be sent to the company.' },
  warn: { label: 'Warn Company', desc: 'Send an official platform warning to the company account.' },
  ban_company: { label: 'Ban Company', desc: 'Immediately suspend the company account and remove all their listings.' },
}

export default function JobModerationPage() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOB_POSTS)
  const [filter, setFilter] = useState<JobFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [note, setNote] = useState('')

  const filtered = jobs.filter((j) => {
    const matchesFilter = filter === 'all' || j.status === filter
    const matchesSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleAction = () => {
    if (!actionModal) return
    if (actionModal.action === 'clear') {
      setJobs((prev) => prev.map((j) => j.id === actionModal.jobId ? { ...j, status: 'active' as JobStatus, flagReason: null, confidence: null } : j))
    } else if (actionModal.action === 'remove') {
      setJobs((prev) => prev.map((j) => j.id === actionModal.jobId ? { ...j, status: 'removed' as JobStatus } : j))
    }
    setActionModal(null)
    setNote('')
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Job Post Moderation" subtitle={`${jobs.filter((j) => j.status === 'flagged').length} flagged · ${jobs.filter((j) => j.status === 'active').length} active`} />

      <div className="px-8 py-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs or companies..."
              className="w-full bg-surface-card border border-surface-border rounded-lg pl-8 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'flagged', 'active'] as JobFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {f}
                <span className="ml-1.5 font-mono opacity-60">
                  {f === 'all' ? jobs.length : jobs.filter((j) => j.status === f).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((job) => {
            const isExpanded = expanded === job.id
            return (
              <div key={job.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : job.id)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{job.title}</p>
                      <p className="text-xs text-text-secondary">{job.company} · {job.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={job.status} />
                    <span className="text-xs text-text-muted font-mono">{job.applications} apps</span>
                    <span className="text-xs text-text-muted font-mono">{formatDate(job.postedAt)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-surface-border px-6 py-5">
                    {job.flagReason && (
                      <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
                        <div className="flex items-start gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="mt-0.5 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                          <div>
                            <p className="text-xs text-error font-semibold mb-0.5">AI Flag: {job.confidence}% confidence</p>
                            <p className="text-xs text-text-secondary">{job.flagReason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {job.status === 'flagged' && (
                        <button
                          onClick={() => setActionModal({ jobId: job.id, jobTitle: job.title, action: 'clear' })}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-trust-high-bg text-trust-high border border-trust-high-border transition-colors"
                        >
                          Clear Flag
                        </button>
                      )}
                      {job.status !== 'removed' && (
                        <button
                          onClick={() => setActionModal({ jobId: job.id, jobTitle: job.title, action: 'remove' })}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-error/15 text-error border border-error/30 transition-colors"
                        >
                          Remove Post
                        </button>
                      )}
                      <button
                        onClick={() => setActionModal({ jobId: job.id, jobTitle: job.title, action: 'warn' })}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-warning/15 text-warning border border-warning/30 transition-colors"
                      >
                        Warn Company
                      </button>
                      <button
                        onClick={() => setActionModal({ jobId: job.id, jobTitle: job.title, action: 'ban_company' })}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface-muted text-text-muted transition-colors"
                      >
                        Ban Company
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-display text-text-primary">{ACTION_DETAILS[actionModal.action].label}</h3>
              <p className="text-sm text-text-secondary mt-1 line-clamp-1">{actionModal.jobTitle}</p>
            </div>
            <div className="bg-surface-muted rounded-lg px-4 py-3">
              <p className="text-sm text-text-secondary">{ACTION_DETAILS[actionModal.action].desc}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Note (optional)</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for audit log..." rows={2}
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setActionModal(null); setNote('') }} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold">Cancel</button>
              <button onClick={handleAction} className="flex-1 py-2.5 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
