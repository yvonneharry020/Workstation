'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface Incident {
  id: string
  title: string
  description: string
  severity: string
  status: string
  type: string
  affected_apps: string[]
  reported_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolution: string | null
  updates: IncidentUpdate[]
}

interface IncidentUpdate {
  message: string
  status: string
  timestamp: string
  author: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400 border-red-800/40',
  high: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  medium: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  low: 'bg-green-900/20 text-green-400 border-green-800/30',
}

const STATUS_FLOW = ['open', 'investigating', 'identified', 'monitoring', 'resolved']

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500',
  investigating: 'bg-orange-500',
  identified: 'bg-yellow-500',
  monitoring: 'bg-blue-500',
  resolved: 'bg-green-500',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const BLANK_FORM = { title: '', description: '', severity: 'medium', type: 'technical', affected_apps: ['candidate_app'] }

export default function IncidentsPage() {
  const supabase = createClient()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('incidents').select('*').order('created_at', { ascending: false })
    setIncidents((data ?? []) as Incident[])
    setLoading(false)
  }

  async function createIncident() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('incidents').insert({
      ...form,
      reported_by: user?.email ?? 'admin',
      updates: [],
    }).select().single()
    if (data) {
      setIncidents(prev => [data as Incident, ...prev])
      setCreating(false)
      setForm(BLANK_FORM)
      setSelected(data as Incident)
    }
    setSaving(false)
  }

  async function advanceStatus(inc: Incident) {
    const currentIdx = STATUS_FLOW.indexOf(inc.status)
    const nextStatus = STATUS_FLOW[currentIdx + 1]
    if (!nextStatus) return
    const update: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === 'resolved') update.resolved_at = new Date().toISOString()
    const { data: updated } = await supabase.from('incidents').update(update).eq('id', inc.id).select().single()
    if (updated) {
      setIncidents(prev => prev.map(i => i.id === inc.id ? updated as Incident : i))
      setSelected(updated as Incident)
    }
  }

  async function addUpdate(inc: Incident) {
    if (!updateMsg.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const newUpdate: IncidentUpdate = {
      message: updateMsg.trim(),
      status: inc.status,
      timestamp: new Date().toISOString(),
      author: user?.email ?? 'admin',
    }
    const updates = [...(inc.updates ?? []), newUpdate]
    const { data: updated } = await supabase.from('incidents').update({ updates }).eq('id', inc.id).select().single()
    if (updated) {
      setIncidents(prev => prev.map(i => i.id === inc.id ? updated as Incident : i))
      setSelected(updated as Incident)
      setUpdateMsg('')
    }
  }

  const filtered = statusFilter === 'all' ? incidents : incidents.filter(i => i.status === statusFilter)

  return (
    <div className="flex h-screen">
      <div className="w-80 flex-shrink-0 border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Incidents</p>
          <button onClick={() => setCreating(true)} className="px-2.5 py-1 text-xs font-semibold bg-tech-500 hover:bg-tech-600 text-white rounded-lg transition-colors">+ New</button>
        </div>
        <div className="px-3 py-2 border-b border-surface-border">
          <div className="flex gap-1 flex-wrap">
            {['all', ...STATUS_FLOW].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-tech-900/50 text-tech-300' : 'text-text-muted hover:text-text-primary'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? <div className="text-text-muted text-sm px-2 py-3">Loading…</div> :
            filtered.map(inc => (
              <button key={inc.id} onClick={() => setSelected(inc)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${selected?.id === inc.id ? 'bg-tech-900/40 border border-tech-800/30' : 'hover:bg-surface-elevated'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">{inc.title}</p>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${STATUS_COLORS[inc.status] ?? 'bg-gray-500'}`} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0 rounded border ${SEVERITY_COLORS[inc.severity] ?? ''}`}>{inc.severity}</span>
                  <span className="text-[10px] text-text-muted capitalize">{inc.type}</span>
                  <span className="text-[10px] text-text-muted ml-auto">{formatDate(inc.created_at)}</span>
                </div>
              </button>
            ))
          }
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {creating ? (
          <div className="px-8 py-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setCreating(false)} className="text-text-muted hover:text-text-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h1 className="text-lg font-semibold font-display text-text-primary">Create Incident</h1>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Title</label>
                <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-tech-500" placeholder="Brief, clear title" />
              </div>
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-tech-500 resize-none" placeholder="What is happening?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Severity</label>
                  <select value={form.severity} onChange={e => setForm(prev => ({ ...prev, severity: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-tech-500">
                    {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-tech-500">
                    {['technical','auth','database','deployment','email','performance','other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createIncident} disabled={saving || !form.title.trim()} className="px-6 py-2.5 bg-tech-500 hover:bg-tech-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {saving ? 'Creating…' : 'Create Incident'}
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="px-8 py-6 max-w-2xl">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${STATUS_COLORS[selected.status] ?? 'bg-gray-500'}`} />
                <div>
                  <h1 className="text-lg font-semibold font-display text-text-primary">{selected.title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${SEVERITY_COLORS[selected.severity] ?? ''}`}>{selected.severity}</span>
                    <span className="text-xs text-text-muted capitalize">{selected.type}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted capitalize">{selected.status}</span>
                  </div>
                </div>
              </div>
              {selected.status !== 'resolved' && (
                <button onClick={() => void advanceStatus(selected)} className="px-3 py-2 bg-tech-500 hover:bg-tech-600 text-white text-xs font-semibold rounded-lg transition-colors capitalize">
                  → {STATUS_FLOW[STATUS_FLOW.indexOf(selected.status) + 1] ?? ''}
                </button>
              )}
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-4 mb-5">
              <p className="text-sm text-text-secondary">{selected.description}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><p className="text-[10px] text-text-muted uppercase tracking-wider">Reported by</p><p className="text-sm text-text-primary mt-0.5">{selected.reported_by ?? '—'}</p></div>
                <div><p className="text-[10px] text-text-muted uppercase tracking-wider">Assigned to</p><p className="text-sm text-text-primary mt-0.5">{selected.assigned_to ?? 'Unassigned'}</p></div>
                <div><p className="text-[10px] text-text-muted uppercase tracking-wider">Opened</p><p className="text-sm text-text-primary mt-0.5">{formatDate(selected.created_at)}</p></div>
                {selected.resolved_at && <div><p className="text-[10px] text-text-muted uppercase tracking-wider">Resolved</p><p className="text-sm text-text-primary mt-0.5">{formatDate(selected.resolved_at)}</p></div>}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Timeline</p>
              {(selected.updates ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No updates yet.</p>
              ) : (
                <ul className="space-y-3 border-l-2 border-tech-800/30 pl-4">
                  {selected.updates.map((u, i) => (
                    <li key={i} className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-tech-500 border-2 border-surface-base" />
                      <p className="text-sm text-text-primary">{u.message}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{u.author} · {formatDate(u.timestamp)} · <span className="capitalize">{u.status}</span></p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.status !== 'resolved' && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Add Update</p>
                <div className="flex gap-3">
                  <textarea value={updateMsg} onChange={e => setUpdateMsg(e.target.value)} rows={2} placeholder="Describe what you found or fixed…" className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-tech-500 resize-none" />
                  <button onClick={() => void addUpdate(selected)} disabled={!updateMsg.trim()} className="px-4 py-2 bg-tech-500 hover:bg-tech-600 text-white text-xs font-semibold rounded-lg self-end transition-colors disabled:opacity-40">Post</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select an incident to view details, or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}
