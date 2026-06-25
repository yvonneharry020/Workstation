'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  title: string
  company_id: string
  description: string | null
  status: string
  location: string | null
  type: string | null
  created_at: string
  company_name: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  active: 'bg-green-900/20 text-green-400 border-green-800/30',
  rejected: 'bg-red-900/20 text-red-400 border-red-800/30',
  closed: 'bg-gray-900/20 text-gray-400 border-gray-800/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function JobsPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Job | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [editNote, setEditNote] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase
      .from('jobs')
      .select('id,title,company_id,description,status,location,type,created_at,company_name')
      .order('created_at', { ascending: false })
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }

  async function updateJobStatus(id: string, status: string) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('jobs').update({ status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.job_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'job',
      severity: 'info',
      app: 'admin_panel',
    })
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
    setActing(null)
  }

  const filtered = statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter)
  const pendingCount = jobs.filter(j => j.status === 'pending').length

  return (
    <div className="flex h-screen">
      <div className="w-80 flex-shrink-0 border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Job Review Queue</p>
          {pendingCount > 0 && <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5">{pendingCount}</span>}
        </div>
        <div className="px-3 py-2 border-b border-surface-border flex gap-1 flex-wrap">
          {['all','pending','active','rejected','closed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-ops-900/50 text-ops-300' : 'text-text-muted hover:text-text-primary'}`}>{s}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? <div className="text-text-muted text-xs px-2 py-3">Loading…</div> :
            filtered.length === 0 ? (
              <p className="text-xs text-text-muted px-2 py-4">No jobs with status: {statusFilter}.</p>
            ) :
            filtered.map(j => (
              <button key={j.id} onClick={() => setSelected(j)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${selected?.id === j.id ? 'bg-ops-900/40 border border-ops-800/30' : 'hover:bg-surface-elevated'}`}>
                <p className="text-xs font-semibold text-text-primary line-clamp-1">{j.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0 rounded border capitalize ${STATUS_COLORS[j.status] ?? ''}`}>{j.status}</span>
                  <span className="text-[10px] text-text-muted">{formatDate(j.created_at)}</span>
                </div>
              </button>
            ))
          }
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="px-8 py-6 max-w-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-semibold font-display text-text-primary">{selected.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${STATUS_COLORS[selected.status] ?? ''}`}>{selected.status}</span>
                  {selected.type && <span className="text-xs text-text-muted capitalize">{selected.type}</span>}
                  {selected.location && <span className="text-xs text-text-muted">{selected.location}</span>}
                </div>
              </div>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Job Details</p>
              <p className="text-sm text-text-secondary">{selected.description ?? 'No description provided.'}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {selected.company_name && (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Company</p>
                    <p className="text-sm text-text-primary mt-0.5">{selected.company_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Posted</p>
                  <p className="text-sm text-text-primary mt-0.5">{formatDate(selected.created_at)}</p>
                </div>
              </div>
            </div>

            {selected.status === 'pending' && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Take Action</p>
                <div className="flex gap-2">
                  <button onClick={() => void updateJobStatus(selected.id, 'active')} disabled={acting === selected.id} className="px-4 py-2 bg-green-900/20 border border-green-800/30 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-900/30 transition-colors disabled:opacity-40">Approve & Publish</button>
                  <button onClick={() => void updateJobStatus(selected.id, 'rejected')} disabled={acting === selected.id} className="px-4 py-2 bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-40">Reject</button>
                </div>
                <div>
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} placeholder="Request edit note (optional)…" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500 resize-none" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select a job posting to review
          </div>
        )}
      </div>
    </div>
  )
}
