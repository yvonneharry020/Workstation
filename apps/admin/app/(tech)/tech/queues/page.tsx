'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stuck'

interface Job {
  id: string
  job_type: string
  status: JobStatus
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error_message: string | null
  attempts: number
  max_attempts: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
}

const STATUS_STYLE: Record<JobStatus, { text: string; bg: string; border: string }> = {
  pending:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)' },
  running:   { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  completed: { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  failed:    { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  stuck:     { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)' },
}

const TABS: { key: JobStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'running',   label: 'Running' },
  { key: 'failed',    label: 'Failed' },
  { key: 'stuck',     label: 'Stuck' },
]

function timeFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })
}

export default function QueuesPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<JobStatus | 'all'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [newJobType, setNewJobType] = useState('')
  const [newJobPayload, setNewJobPayload] = useState('{}')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('background_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { void load() }, 15_000)
    return () => clearInterval(id)
  }, [load])

  const retryJob = useCallback(async (id: string) => {
    setActing(id)
    await supabase.from('background_jobs').update({ status: 'pending', attempts: 0, error_message: null, started_at: null }).eq('id', id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'pending', attempts: 0, error_message: null } : j))
    setActing(null)
  }, [supabase])

  const cancelJob = useCallback(async (id: string) => {
    setActing(id)
    await supabase.from('background_jobs').update({ status: 'failed', error_message: 'Cancelled by admin' }).eq('id', id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'failed', error_message: 'Cancelled by admin' } : j))
    setActing(null)
  }, [supabase])

  const createJob = useCallback(async () => {
    if (!newJobType.trim()) { setCreateError('Job type is required'); return }
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(newJobPayload) } catch { setCreateError('Invalid JSON payload'); return }
    setCreating(true)
    setCreateError('')
    const { error } = await supabase.from('background_jobs').insert({
      job_type: newJobType.trim(),
      payload,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date().toISOString(),
    })
    if (error) { setCreateError(error.message) } else {
      setNewJobType('')
      setNewJobPayload('{}')
      void load()
    }
    setCreating(false)
  }, [supabase, newJobType, newJobPayload, load])

  const filtered = tab === 'all' ? jobs : jobs.filter(j => j.status === tab)

  const counts = {
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    stuck: jobs.filter(j => j.status === 'stuck').length,
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Job Queue Monitor" subtitle="Background jobs, retries, and queue health" />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {(Object.entries(counts) as [JobStatus, number][]).map(([status, count]) => {
            const ss = STATUS_STYLE[status]
            return (
              <div key={status} style={{ ...CARD_STYLE, padding: '18px 20px' }}>
                <p className="text-[11px] uppercase tracking-wide mb-1 font-semibold capitalize" style={{ color: 'var(--tx-3)' }}>{status}</p>
                <p className="text-[28px] font-bold font-display" style={{ color: ss.text }}>{count}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Job list */}
          <div className="col-span-2" style={{ ...CARD_STYLE, padding: '24px' }}>
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    backgroundColor: tab === t.key ? 'rgba(6,182,212,0.15)' : 'var(--bg-elevated)',
                    color: tab === t.key ? '#06B6D4' : 'var(--tx-2)',
                    border: tab === t.key ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border)',
                  }}
                >
                  {t.label}
                  {t.key !== 'all' && counts[t.key] > 0 && (
                    <span className="ml-1.5 text-[10px] rounded-full px-1.5" style={{ backgroundColor: STATUS_STYLE[t.key].bg, color: STATUS_STYLE[t.key].text }}>
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              ))}
              <button onClick={() => void load()} className="ml-auto text-[12px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                {/* CSS illustration */}
                <div style={{ width: 64, height: 64, borderRadius: '50%', border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--bg-elevated)' }} />
                </div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-2)' }}>No jobs in queue</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--tx-3)' }}>Create a test job to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Type', 'Status', 'Attempts', 'Scheduled', 'Error', 'Actions'].map(h => (
                        <th key={h} className="text-left pb-2 pr-3 font-semibold text-[11px] uppercase tracking-wide" style={{ color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(job => {
                      const ss = STATUS_STYLE[job.status]
                      const isActing = acting === job.id
                      return (
                        <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2 pr-3 font-mono text-[12px]" style={{ color: 'var(--tx-1)' }}>{job.job_type}</td>
                          <td className="py-2 pr-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color: ss.text, backgroundColor: ss.bg, borderColor: ss.border }}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-mono text-[12px]" style={{ color: 'var(--tx-2)' }}>{job.attempts}/{job.max_attempts}</td>
                          <td className="py-2 pr-3 text-[12px]" style={{ color: 'var(--tx-3)' }}>{timeFmt(job.scheduled_at)}</td>
                          <td className="py-2 pr-3 text-[12px] max-w-[120px] truncate" style={{ color: '#F87171' }} title={job.error_message ?? ''}>
                            {job.error_message ? job.error_message.slice(0, 30) + (job.error_message.length > 30 ? '…' : '') : '—'}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              {job.status === 'failed' && (
                                <button
                                  disabled={isActing}
                                  onClick={() => void retryJob(job.id)}
                                  className="px-2 py-1 rounded text-[11px] font-semibold"
                                  style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}
                                >
                                  Retry
                                </button>
                              )}
                              {(job.status === 'stuck' || job.status === 'pending') && (
                                <button
                                  disabled={isActing}
                                  onClick={() => void cancelJob(job.id)}
                                  className="px-2 py-1 rounded text-[11px] font-semibold"
                                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create job form */}
          <div style={{ ...CARD_STYLE, padding: '24px', height: 'fit-content' }}>
            <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Create Test Job</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--tx-2)' }}>Job Type</label>
                <input
                  value={newJobType}
                  onChange={e => setNewJobType(e.target.value)}
                  placeholder="e.g. send_welcome_email"
                  className="w-full px-3 py-2 rounded-lg text-[13px]"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--tx-2)' }}>Payload (JSON)</label>
                <textarea
                  value={newJobPayload}
                  onChange={e => setNewJobPayload(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg text-[12px] font-mono resize-none"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
                />
              </div>
              {createError && <p className="text-[12px]" style={{ color: '#F87171' }}>{createError}</p>}
              <button
                onClick={() => void createJob()}
                disabled={creating}
                className="w-full py-2.5 rounded-lg text-[13px] font-semibold transition-all"
                style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)', opacity: creating ? 0.6 : 1 }}
              >
                {creating ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
