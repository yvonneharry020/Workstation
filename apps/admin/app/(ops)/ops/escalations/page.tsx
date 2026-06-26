'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type EscLevel = 'L1' | 'L2' | 'L3'
type EscStatus = 'open' | 'in_review' | 'resolved'

interface Escalation {
  id: string
  created_at: string
  source_type: 'ticket' | 'chat' | 'dispute' | 'manual'
  source_id: string | null
  subject: string
  description: string
  level: EscLevel
  status: EscStatus
  assigned_to: string | null
  user_name: string | null
  user_email: string | null
  resolved_at: string | null
  notes: string | null
  raised_by: string | null
  raised_by_email: string | null
}

const LEVEL_STYLES: Record<EscLevel, string> = {
  L1: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  L2: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  L3: 'bg-error/15 text-error border-error/30',
}

const STATUS_STYLES: Record<EscStatus, string> = {
  open:      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  in_review: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  resolved:  'bg-trust-high-bg text-trust-high border-trust-high-border',
}

const STAFF_OPTIONS = [
  'yvonne2okis@gmail.com', 'support@workstation.ng', 'tech@workstation.ng',
  'billing@workstation.ng', 'verification@workstation.ng',
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

const EMPTY: Escalation[] = []

export default function EscalationsPage() {
  const supabase = createClient()
  const [escalations, setEscalations] = useState<Escalation[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<EscStatus | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<EscLevel | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [createForm, setCreateForm] = useState({
    subject: '', description: '', level: 'L1' as EscLevel,
    source_type: 'manual' as Escalation['source_type'],
    user_name: '', user_email: '', assigned_to: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('escalations')
        .select('*')
        .order('created_at', { ascending: false })
      setEscalations((data as Escalation[] | null) ?? EMPTY)
      setLoading(false)
    }
    void load()
  }, [supabase])

  const selected = escalations.find(e => e.id === selectedId)

  const filtered = escalations.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    return true
  })

  async function handleCreate() {
    if (!createForm.subject.trim() || !createForm.description.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('escalations').insert({
      subject: createForm.subject.trim(),
      description: createForm.description.trim(),
      level: createForm.level,
      source_type: createForm.source_type,
      user_name: createForm.user_name.trim() || null,
      user_email: createForm.user_email.trim() || null,
      assigned_to: createForm.assigned_to || null,
      status: 'open',
      raised_by: user?.id ?? null,
      raised_by_email: user?.email ?? null,
    }).select().single()
    if (!error && data) {
      setEscalations(prev => [data as Escalation, ...prev])
      setShowCreate(false)
      setCreateForm({ subject: '', description: '', level: 'L1', source_type: 'manual', user_name: '', user_email: '', assigned_to: '' })
    }
    setCreating(false)
  }

  async function handleStatusChange(status: EscStatus) {
    if (!selectedId) return
    const update: Partial<Escalation> = { status }
    if (status === 'resolved') update.resolved_at = new Date().toISOString()
    await supabase.from('escalations').update(update).eq('id', selectedId)
    setEscalations(prev => prev.map(e => e.id === selectedId ? { ...e, ...update } : e))
  }

  async function handleSaveNotes() {
    if (!selectedId || !notes.trim()) return
    setSavingNotes(true)
    await supabase.from('escalations').update({ notes: notes.trim() }).eq('id', selectedId)
    setEscalations(prev => prev.map(e => e.id === selectedId ? { ...e, notes: notes.trim() } : e))
    setSavingNotes(false)
  }

  const openCount = escalations.filter(e => e.status === 'open').length
  const l3Count = escalations.filter(e => e.level === 'L3' && e.status !== 'resolved').length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Escalation Queue"
        subtitle={`${openCount} open${l3Count > 0 ? ` · ${l3Count} critical L3` : ''}`}
        actions={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Raise Escalation
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[380px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border space-y-2">
            <div className="flex gap-1.5">
              {(['all','open','in_review','resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-ops-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s === 'in_review' ? 'In Review' : s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s === 'open' && openCount > 0 && <span className="ml-1 text-[9px] bg-error/20 text-error rounded px-1">{openCount}</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all','L1','L2','L3'] as const).map(l => (
                <button key={l} onClick={() => setLevelFilter(l)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${levelFilter === l ? 'text-text-primary bg-surface-border' : 'text-text-muted hover:text-text-secondary'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading escalations…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p className="text-text-muted text-sm">No escalations match this filter</p>
              </div>
            ) : filtered.map(e => {
              const isActive = selectedId === e.id
              return (
                <button key={e.id} onClick={() => { setSelectedId(e.id); setNotes('') }}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${isActive ? 'bg-ops-900/40 border-l-2 border-l-ops-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${LEVEL_STYLES[e.level]}`}>{e.level}</span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[e.status]}`}>
                        {e.status === 'in_review' ? 'In Review' : e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{relativeTime(e.created_at)}</span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary truncate mb-0.5">{e.subject}</p>
                  {e.user_name && <p className="text-[11px] text-text-muted">{e.user_name}</p>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                <p className="text-sm">Select an escalation to review</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${LEVEL_STYLES[selected.level]}`}>{selected.level}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>
                      {selected.status === 'in_review' ? 'In Review' : selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono capitalize">{selected.source_type}</span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {selected.user_name && `${selected.user_name} · `}{selected.user_email && `${selected.user_email} · `}Raised {formatTime(selected.created_at)}
                  </p>
                </div>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.status !== 'resolved' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Update Status</p>
                  <div className="flex gap-2">
                    {(['open','in_review','resolved'] as const).map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selected.status === s ? STATUS_STYLES[s] : 'bg-surface-elevated border-surface-border text-text-secondary hover:text-text-primary'}`}>
                        {s === 'in_review' ? 'In Review' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.resolved_at && (
                <div className="bg-trust-high-bg border border-trust-high-border rounded-xl px-4 py-3">
                  <p className="text-xs text-trust-high font-semibold">Resolved {formatTime(selected.resolved_at)}</p>
                </div>
              )}

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Team Notes</p>
                <textarea value={notes || selected.notes || ''} onChange={e => setNotes(e.target.value)}
                  placeholder="Add investigation notes, actions taken, decisions made…" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none mb-2" />
                <button onClick={handleSaveNotes} disabled={savingNotes || !notes.trim()}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Raise Escalation</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Escalation Level</label>
                <div className="flex gap-2">
                  {(['L1','L2','L3'] as const).map(l => (
                    <button key={l} onClick={() => setCreateForm(f => ({ ...f, level: l }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${createForm.level === l ? LEVEL_STYLES[l] : 'bg-surface-elevated border-surface-border text-text-secondary'}`}>
                      {l}{l === 'L3' ? ' — Critical' : l === 'L2' ? ' — High' : ' — Standard'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Subject *</label>
                <input type="text" value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief description of the issue"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Description *</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="What happened and what needs to be resolved?" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">User name</label>
                  <input type="text" value={createForm.user_name} onChange={e => setCreateForm(f => ({ ...f, user_name: e.target.value }))} placeholder="Affected user"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">User email</label>
                  <input type="email" value={createForm.user_email} onChange={e => setCreateForm(f => ({ ...f, user_email: e.target.value }))} placeholder="user@email.com"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Assign to</label>
                <select value={createForm.assigned_to} onChange={e => setCreateForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                  <option value="">Unassigned</option>
                  {STAFF_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !createForm.subject.trim() || !createForm.description.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                  {creating ? 'Raising…' : 'Raise Escalation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
