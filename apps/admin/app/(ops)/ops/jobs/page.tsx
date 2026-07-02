'use client'

import { useState, useEffect } from 'react'
import { createTabClient } from '@/lib/supabase/tab-client'

type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'expired'

interface Job {
  id: string
  title: string
  status: JobStatus
  screening_type: 'normal' | 'timed_quiz'
  created_at: string
  applications_count: number
  application_deadline: string | null
  posted_by: string
  company_profiles: { company_name: string | null } | null
}

const STATUS_CONFIG: Record<JobStatus, { label: string; classes: string }> = {
  draft:   { label: 'Draft',   classes: 'bg-gray-900/30 text-gray-400 border-gray-700/30' },
  active:  { label: 'Live',    classes: 'bg-green-900/20 text-green-400 border-green-800/30' },
  paused:  { label: 'Paused',  classes: 'bg-amber-900/20 text-amber-400 border-amber-800/30' },
  closed:  { label: 'Closed',  classes: 'bg-red-900/20 text-red-400 border-red-800/30' },
  expired: { label: 'Expired', classes: 'bg-purple-900/20 text-purple-400 border-purple-800/30' },
}

const FILTER_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'draft',   label: 'Draft' },
  { key: 'active',  label: 'Live' },
  { key: 'paused',  label: 'Paused' },
  { key: 'closed',  label: 'Closed' },
  { key: 'expired', label: 'Expired' },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function JobQueuePage() {
  const supabase = createTabClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    void load()

    const channel = supabase
      .channel('job-queue-realtime')
      // When a candidate submits an application — instantly increment the count
      // for that specific job without re-fetching the whole list
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_applications' },
        (payload) => {
          const jobId = (payload.new as { job_id: string }).job_id
          setJobs(prev =>
            prev.map(j =>
              j.id === jobId ? { ...j, applications_count: j.applications_count + 1 } : j
            )
          )
        }
      )
      // When job status, deadline, or any other field changes — re-sync
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => { void load() }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  async function load() {
    const { data } = await supabase
      .from('job_postings')
      .select(
        'id, title, status, screening_type, created_at, applications_count, application_deadline, posted_by, company_profiles!company_id(company_name)'
      )
      .order('created_at', { ascending: false })
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }

  async function toggleClose(job: Job) {
    if (toggling) return
    setToggling(job.id)

    const closing = job.status !== 'closed'
    const newStatus: JobStatus = closing ? 'closed' : 'active'

    await supabase
      .from('job_postings')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', job.id)

    if (closing) {
      await supabase.from('notifications').insert({
        user_id: job.posted_by,
        type: 'system',
        title: 'Job Posting Closed by Admin',
        body: `Your job posting "${job.title}" has been temporarily closed by the Workstation admin team following a review. No new candidates will be able to view or apply to this posting. If you have any questions or require further clarification, please contact us directly via the Live Chat feature in your dashboard and our team will assist you promptly.`,
        data: { job_id: job.id },
      })
    }

    setJobs(prev =>
      prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j)
    )
    setToggling(null)
  }

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold font-display text-text-primary">Job Queue</h1>
        <p className="text-sm text-text-muted mt-1">
          All job postings across every company on Workstation. Applications and status update in real time.
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-surface-border pb-2">
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
            {tab.key === 'all' && !loading && (
              <span className="ml-1.5 text-text-muted font-normal">({jobs.length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">ATS</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Screening Mode</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Deadline</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Date & Time Created</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Admin Close</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted text-xs">Loading jobs…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted text-xs">
                  {filter === 'all' ? 'No jobs posted yet.' : `No ${filter === 'active' ? 'live' : filter} jobs.`}
                </td>
              </tr>
            ) : filtered.map((job, i) => {
              const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.draft
              const isClosed = job.status === 'closed'
              const isToggling = toggling === job.id
              const canToggle = job.status !== 'draft' && job.status !== 'expired'

              return (
                <tr
                  key={job.id}
                  className={`border-b border-surface-border/50 transition-colors hover:bg-surface-elevated/60 ${i % 2 !== 0 ? 'bg-surface-elevated/20' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                    {job.company_profiles?.company_name ?? <span className="text-text-muted italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[180px] truncate">{job.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${statusCfg.classes}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                      <span className="text-text-primary font-semibold tabular-nums">{job.applications_count}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {job.screening_type === 'timed_quiz' ? 'Timed Quiz' : 'Normal Form'}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                    {job.application_deadline ? formatDate(job.application_deadline) : <span className="italic">No deadline</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                    {formatDateTime(job.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {canToggle ? (
                      <button
                        onClick={() => void toggleClose(job)}
                        disabled={isToggling}
                        title={isClosed ? 'Unlock — restore job to live' : 'Close — hide job from all candidates'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                          isClosed
                            ? 'bg-red-500 border-red-500'
                            : 'bg-surface-elevated border-surface-border'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform duration-200 ease-in-out ${
                            isClosed ? 'translate-x-4 bg-white' : 'translate-x-0 bg-text-muted'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-text-muted text-[10px] italic">N/A</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
