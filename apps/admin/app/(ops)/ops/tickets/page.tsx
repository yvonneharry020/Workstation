'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type TicketStatus = 'sent' | 'in_progress' | 'resolved' | 'closed'
type TicketCategory = 'general' | 'verification' | 'billing' | 'technical' | 'account' | 'other'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
type SubmitterType = 'candidate' | 'company' | 'admin'

interface Ticket {
  id: string
  ticket_number: string
  created_at: string
  updated_at: string
  submitted_by: string | null
  submitter_type: SubmitterType
  submitter_name: string
  submitter_email: string
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  assigned_to: string | null
  department: string | null
  resolved_at: string | null
  resolution_note: string | null
  internal_notes: string | null
  source: string
  created_by_email: string | null
  first_responded_at: string | null
  transferred_at: string | null
  transferred_by_email: string | null
  resolved_by_email: string | null
  parent_ticket_id: string | null
  routed_to_dept: string | null
  dept_resolved: boolean
  dept_resolved_by_email: string | null
  dept_resolved_at: string | null
  escalation_raised: boolean
  escalation_raised_at: string | null
  escalation_raised_by: string | null
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  sent:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  in_progress: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  resolved:    'bg-trust-high-bg text-trust-high border-trust-high-border',
  closed:      'bg-surface-muted text-text-muted border-surface-border',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  sent: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
}

const PRIORITY_STYLES: Record<TicketPriority, { dot: string; label: string }> = {
  low:    { dot: 'bg-text-muted', label: 'Low' },
  normal: { dot: 'bg-trust-mid',  label: 'Normal' },
  high:   { dot: 'bg-warning',    label: 'High' },
  urgent: { dot: 'bg-error',      label: 'Urgent' },
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: 'General', verification: 'Verification', billing: 'Billing',
  technical: 'Technical', account: 'Account', other: 'Other',
}

const SUBMITTER_BADGE: Record<SubmitterType, { label: string; color: string }> = {
  candidate: { label: 'Candidate', color: '#0DD4C3' },
  company:   { label: 'Company',   color: '#F59E0B' },
  admin:     { label: 'Admin',     color: '#A855F7' },
}

const ROUTE_DEPTS = [
  { dept: 'Technical', label: 'Technical Room', desc: 'Bugs, access issues, platform errors' },
  { dept: 'Finance',   label: 'Finance Room',   desc: 'Billing, payments, subscriptions' },
  { dept: 'Admin',     label: 'Admin Inbox',    desc: 'Escalate to super admin' },
] as const

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function OpsTicketsPage() {
  const [tickets, setTickets]           = useState<Ticket[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [emailSearch, setEmailSearch]   = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [savingNote, setSavingNote]     = useState(false)
  const [resolving, setResolving]       = useState(false)
  const [routing, setRouting]           = useState(false)
  const [escalating, setEscalating]     = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [creating, setCreating]         = useState(false)
  const [createForm, setCreateForm]     = useState({
    submitter_name: '', submitter_email: '', submitter_type: 'candidate' as SubmitterType,
    subject: '', description: '', category: 'general' as TicketCategory,
    priority: 'normal' as TicketPriority,
  })
  const supabase = createClient()

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .is('parent_ticket_id', null)
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const ch = supabase.channel('ops-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload) => {
        const t = payload.new as Ticket
        if (t.parent_ticket_id === null) setTickets(prev => [t, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (payload) => {
        const t = payload.new as Ticket
        if (t.parent_ticket_id === null) {
          setTickets(prev => prev.map(x => x.id === t.id ? t : x))
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  const selected = tickets.find(t => t.id === selectedId)

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (emailSearch.trim()) {
      const q = emailSearch.trim().toLowerCase()
      if (!t.submitter_email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const newCount = tickets.filter(t => t.status === 'sent').length

  async function handleSelectTicket(id: string) {
    setSelectedId(id)
    setResolutionNote('')
    setInternalNote('')
    const ticket = tickets.find(t => t.id === id)
    if (!ticket || ticket.status !== 'sent') return
    await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', id)
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' } : t))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.ticket_opened', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'support_ticket',
      target_name: ticket.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: ticket.ticket_number },
    })
  }

  async function handleResolve() {
    if (!selectedId || !selected) return
    setResolving(true)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('support_tickets').update({
      status: 'resolved',
      resolved_at: now,
      resolution_note: resolutionNote.trim() || null,
      resolved_by_email: user?.email ?? null,
      first_responded_at: selected.first_responded_at ?? now,
    }).eq('id', selectedId)
    await supabase.from('ticket_timeline').insert({
      ticket_id: selectedId, event: 'resolved',
      actor_email: user?.email ?? null, note: resolutionNote.trim() || null,
    })
    setTickets(prev => prev.map(t => t.id === selectedId
      ? { ...t, status: 'resolved', resolved_at: now, resolution_note: resolutionNote.trim() || null, resolved_by_email: user?.email ?? null }
      : t))
    await supabase.from('audit_logs').insert({
      event: 'admin.ticket_resolved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number },
    })
    setResolutionNote('')
    setResolving(false)
  }

  async function handleSaveInternalNote() {
    if (!selectedId || !internalNote.trim()) return
    setSavingNote(true)
    const merged = selected?.internal_notes
      ? `${selected.internal_notes}\n${internalNote.trim()}`
      : internalNote.trim()
    await supabase.from('support_tickets').update({ internal_notes: merged }).eq('id', selectedId)
    setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, internal_notes: merged } : t))
    setInternalNote('')
    setSavingNote(false)
  }

  async function handleRouteToDeptt(targetDept: string) {
    if (!selectedId || !selected) return
    setRouting(true)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('support_tickets').insert({
      parent_ticket_id: selectedId,
      submitter_type: selected.submitter_type,
      submitter_name: selected.submitter_name,
      submitter_email: selected.submitter_email,
      subject: selected.subject,
      description: selected.description,
      category: selected.category,
      priority: selected.priority,
      status: 'sent',
      department: targetDept,
      source: 'admin_created',
      internal_notes: null,
      created_by_email: user?.email ?? null,
    })

    await supabase.from('support_tickets').update({
      routed_to_dept: targetDept,
      transferred_at: now,
      transferred_by_email: user?.email ?? null,
    }).eq('id', selectedId)

    await supabase.from('ticket_timeline').insert({
      ticket_id: selectedId, event: 'routed',
      actor_email: user?.email ?? null, to_dept: targetDept,
      note: `Routed a copy to ${targetDept} department`,
    })

    setTickets(prev => prev.map(t => t.id === selectedId
      ? { ...t, routed_to_dept: targetDept, transferred_at: now, transferred_by_email: user?.email ?? null }
      : t))
    setRouting(false)
  }

  async function handleRaiseEscalation() {
    if (!selectedId || !selected || !selected.routed_to_dept) return
    setEscalating(true)
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('support_tickets').update({
      escalation_raised: true,
      escalation_raised_at: now,
      escalation_raised_by: user?.email ?? null,
    }).eq('id', selectedId)

    await supabase.from('support_tickets').update({
      escalation_raised: true,
      escalation_raised_at: now,
      escalation_raised_by: user?.email ?? null,
    }).eq('parent_ticket_id', selectedId)

    await supabase.from('ticket_timeline').insert({
      ticket_id: selectedId, event: 'escalation_raised',
      actor_email: user?.email ?? null,
      note: `Escalation raised — ${selected.routed_to_dept} dept alerted`,
    })

    setTickets(prev => prev.map(t => t.id === selectedId
      ? { ...t, escalation_raised: true, escalation_raised_at: now, escalation_raised_by: user?.email ?? null }
      : t))
    setEscalating(false)
  }

  async function handleCreateTicket() {
    if (!createForm.subject.trim() || !createForm.description.trim() || !createForm.submitter_email.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('support_tickets').insert({
      submitted_by: null,
      submitter_type: createForm.submitter_type,
      submitter_name: createForm.submitter_name.trim() || createForm.submitter_email.split('@')[0],
      submitter_email: createForm.submitter_email.trim(),
      subject: createForm.subject.trim(),
      description: createForm.description.trim(),
      category: createForm.category,
      priority: createForm.priority,
      status: 'in_progress',
      assigned_to: null,
      department: 'Management',
      source: 'admin_created',
      created_by_email: user?.email ?? null,
      first_responded_at: now,
    }).select().single()
    if (!error && data) {
      await supabase.from('ticket_timeline').insert({
        ticket_id: (data as Ticket).id, event: 'created',
        actor_email: user?.email ?? null, to_dept: 'Management',
      })
      await supabase.from('audit_logs').insert({
        event: 'admin.ticket_created', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
        actor_type: 'admin', target_id: (data as Ticket).id, target_type: 'support_ticket',
        target_name: createForm.subject, severity: 'info', app: 'admin_panel',
      })
      setShowCreate(false)
      setCreateForm({
        submitter_name: '', submitter_email: '', submitter_type: 'candidate',
        subject: '', description: '', category: 'general', priority: 'normal',
      })
    }
    setCreating(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Support Tickets"
        subtitle={`${tickets.length} total · ${newCount} new`}
        actions={
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-lg bg-ops-500 hover:bg-ops-600 text-white text-xs font-semibold transition-colors">
            + Create Ticket
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* ── List pane ─────────────────────────────────────────────────────── */}
        <div className="w-[360px] flex-shrink-0 border-r border-surface-border flex flex-col">

          {/* Email search */}
          <div className="px-3 pt-3 pb-2 border-b border-surface-border/50">
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text" value={emailSearch} onChange={e => setEmailSearch(e.target.value)}
                placeholder="Search by email…"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 py-2.5 border-b border-surface-border space-y-1.5">
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'sent', 'in_progress', 'resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                    ${statusFilter === s ? 'bg-ops-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s as TicketStatus]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all', 'urgent', 'high', 'normal', 'low'] as const).map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors
                    ${priorityFilter === p ? 'bg-surface-border text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                  {p === 'all' ? 'Any' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-elevated mx-auto mb-3 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm text-text-muted">No tickets found</p>
              </div>
            ) : filtered.map(t => {
              const isEscalated = t.escalation_raised && !t.dept_resolved && t.status !== 'resolved'
              return (
                <button key={t.id} onClick={() => handleSelectTicket(t.id)}
                  className={`w-full text-left px-4 py-3.5 relative transition-colors
                    ${isEscalated
                      ? 'border-l-2 border-l-red-500 bg-red-500/5'
                      : selectedId === t.id
                        ? 'bg-ops-900/30 border-l-2 border-l-ops-500'
                        : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'
                    }`}>
                  {isEscalated && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5 animate-pulse">
                      <WarningIcon className="text-red-400" />
                      <span className="text-[9px] font-bold text-red-400">ESC</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                    <span className="text-[9px] text-text-muted">{relativeTime(t.created_at)}</span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary mb-0.5 truncate pr-14">{t.subject}</p>
                  <p className="text-[11px] text-text-secondary mb-2 truncate">{t.submitter_name} · {t.submitter_email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-semibold uppercase border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_STYLES[t.priority].dot}`} />{t.priority}
                    </span>
                    {t.routed_to_dept && !t.dept_resolved && (
                      <span className="text-[9px] text-ops-400 font-mono">→ {t.routed_to_dept}</span>
                    )}
                    {t.dept_resolved && (
                      <span className="text-[9px] text-green-400 font-mono">✓ {t.routed_to_dept}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Detail pane ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <p className="text-sm">Select a ticket to view details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-mono text-text-muted">{selected.ticket_number}</span>
                    <span className={`text-[10px] font-semibold uppercase border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_STYLES[selected.priority].dot}`} />{selected.priority}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ color: SUBMITTER_BADGE[selected.submitter_type].color }}>
                      {SUBMITTER_BADGE[selected.submitter_type].label}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {selected.submitter_name} · {selected.submitter_email} · {formatTime(selected.created_at)}
                  </p>
                  {selected.created_by_email && (
                    <p className="text-[11px] text-text-muted mt-0.5">Created by {selected.created_by_email}</p>
                  )}
                </div>
                {selected.status !== 'resolved' && selected.status !== 'closed' && (
                  <button onClick={handleResolve} disabled={resolving}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-ops-500/20 text-ops-400 border border-ops-500/30 text-xs font-semibold hover:bg-ops-500/30 disabled:opacity-40 transition-colors">
                    {resolving ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Issue Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Resolution note textarea (unresolved only) */}
              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Resolution Note <span className="font-normal normal-case text-text-muted">(optional)</span>
                  </p>
                  <textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                    placeholder="Describe how the issue was resolved…" rows={3}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
                </div>
              )}

              {/* Resolution summary card */}
              {selected.status === 'resolved' && (
                <div className="bg-trust-high-bg border border-trust-high-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-trust-high uppercase tracking-wider mb-1">Resolved</p>
                  {selected.resolution_note && <p className="text-sm text-text-primary mb-1">{selected.resolution_note}</p>}
                  {selected.resolved_at && <p className="text-xs text-text-muted">{formatTime(selected.resolved_at)}</p>}
                  {selected.resolved_by_email && <p className="text-xs text-text-muted">By {selected.resolved_by_email}</p>}
                </div>
              )}

              {/* Route to Department */}
              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Route to Department</p>
                    {selected.routed_to_dept && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border
                        ${selected.dept_resolved
                          ? 'text-green-400 bg-green-500/10 border-green-500/30'
                          : 'text-ops-400 bg-ops-500/10 border-ops-500/30'
                        }`}>
                        {selected.dept_resolved ? '✓ Resolved' : `Routed → ${selected.routed_to_dept}`}
                      </span>
                    )}
                  </div>

                  {!selected.routed_to_dept ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-text-muted mb-3">
                        Send a copy of this ticket to a department. Management keeps the original and tracks progress here.
                      </p>
                      {ROUTE_DEPTS.map(({ dept, label, desc }) => (
                        <button key={dept} onClick={() => handleRouteToDeptt(dept)} disabled={routing}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-surface-elevated border-surface-border hover:border-ops-500/40 hover:bg-ops-900/10 text-left transition-colors disabled:opacity-50">
                          <div>
                            <p className="text-xs font-semibold text-text-primary">{label}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{desc}</p>
                          </div>
                          {routing
                            ? <span className="text-[10px] text-text-muted">Routing…</span>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          }
                        </button>
                      ))}
                    </div>
                  ) : selected.dept_resolved ? (
                    <div className="bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <p className="text-xs font-semibold text-green-400">Issue resolved by {selected.routed_to_dept} dept</p>
                      </div>
                      {selected.dept_resolved_by_email && (
                        <p className="text-[11px] text-text-muted mt-1">By {selected.dept_resolved_by_email}</p>
                      )}
                      {selected.dept_resolved_at && (
                        <p className="text-[11px] text-text-muted">On {formatTime(selected.dept_resolved_at)}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-ops-900/10 border border-ops-500/20 rounded-xl p-4">
                        <p className="text-[11px] text-text-secondary">
                          A copy was sent to <span className="font-semibold text-ops-400">{selected.routed_to_dept}</span>.
                          They will resolve it and the status will update here automatically.
                        </p>
                        {selected.transferred_at && (
                          <p className="text-[10px] text-text-muted mt-1.5">
                            Routed {formatTime(selected.transferred_at)}
                            {selected.transferred_by_email ? ` by ${selected.transferred_by_email}` : ''}
                          </p>
                        )}
                      </div>

                      {selected.escalation_raised ? (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
                          <WarningIcon className="text-red-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-red-400">Escalation raised</p>
                            {selected.escalation_raised_at && (
                              <p className="text-[10px] text-text-muted">{formatTime(selected.escalation_raised_at)}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleRaiseEscalation} disabled={escalating}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 text-xs font-semibold transition-colors disabled:opacity-50">
                          <WarningIcon />
                          {escalating ? 'Raising escalation…' : 'Raise Escalation'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Internal notes */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Internal Notes <span className="font-normal normal-case text-text-muted">(not shown to user)</span>
                </p>
                {selected.internal_notes && (
                  <pre className="text-[11px] text-text-secondary bg-surface-elevated rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap font-mono leading-relaxed border border-surface-border">
                    {selected.internal_notes}
                  </pre>
                )}
                <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)}
                  placeholder="Add a private note for your team…" rows={3}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none mb-2" />
                <button onClick={handleSaveInternalNote} disabled={savingNote || !internalNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create ticket modal ───────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Create Support Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-2">
                {(['candidate', 'company'] as const).map(t => (
                  <button key={t} onClick={() => setCreateForm(f => ({ ...f, submitter_type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors
                      ${createForm.submitter_type === t ? 'bg-ops-500 text-white border-ops-500' : 'bg-surface-elevated text-text-secondary border-surface-border'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Name</label>
                  <input type="text" value={createForm.submitter_name}
                    onChange={e => setCreateForm(f => ({ ...f, submitter_name: e.target.value }))}
                    placeholder="User's name"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Email *</label>
                  <input type="email" value={createForm.submitter_email}
                    onChange={e => setCreateForm(f => ({ ...f, submitter_email: e.target.value }))}
                    placeholder="user@email.com"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Subject *</label>
                <input type="text" value={createForm.subject}
                  onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="What is the issue about?"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Category</label>
                  <select value={createForm.category}
                    onChange={e => setCreateForm(f => ({ ...f, category: e.target.value as TicketCategory }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Priority</label>
                  <select value={createForm.priority}
                    onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    {Object.entries(PRIORITY_STYLES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Description *</label>
                <textarea value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue…" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateTicket}
                  disabled={creating || !createForm.subject.trim() || !createForm.description.trim() || !createForm.submitter_email.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                  {creating ? 'Creating…' : 'Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
