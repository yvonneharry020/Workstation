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
  low:    { dot: 'bg-text-muted',  label: 'Low' },
  normal: { dot: 'bg-trust-mid',   label: 'Normal' },
  high:   { dot: 'bg-warning',     label: 'High' },
  urgent: { dot: 'bg-error',       label: 'Urgent' },
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

const STAFF_OPTIONS = [
  'yvonne2okis@gmail.com', 'support@workstation.ng', 'tech@workstation.ng',
  'billing@workstation.ng', 'verification@workstation.ng',
]

const DEPARTMENT_OPTIONS = ['Management', 'Technical', 'Finance', 'Admin', 'Billing', 'Verification', 'Support']

const DEPT_ROOMS = [
  { dept: 'Technical', label: 'Technical Room', desc: 'Bugs, access issues, platform errors', color: 'tech' },
  { dept: 'Finance', label: 'Finance Room', desc: 'Billing, payments, subscriptions', color: 'finance' },
  { dept: 'Admin', label: 'Admin Inbox', desc: 'Escalate to super admin', color: 'admin' },
] as const

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
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

export default function OpsTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [resolutionNote, setResolutionNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    submitter_name: '', submitter_email: '', submitter_type: 'candidate' as SubmitterType,
    subject: '', description: '', category: 'general' as TicketCategory,
    priority: 'normal' as TicketPriority, assigned_to: '', department: '',
  })
  const [creating, setCreating] = useState(false)
  const supabase = createClient()

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const ch = supabase.channel('ops-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload) => {
        setTickets(prev => [payload.new as Ticket, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (payload) => {
        setTickets(prev => prev.map(t => t.id === (payload.new as Ticket).id ? payload.new as Ticket : t))
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  const selected = tickets.find(t => t.id === selectedId)

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
      actor_type: 'staff', target_id: id, target_type: 'support_ticket',
      target_name: ticket.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: ticket.ticket_number },
    })
  }

  async function handleResolve() {
    if (!selectedId || !selected) return
    setResolving(true)
    await supabase.from('support_tickets').update({
      status: 'resolved', resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote.trim() || null,
    }).eq('id', selectedId)
    setTickets(prev => prev.map(t => t.id === selectedId
      ? { ...t, status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: resolutionNote.trim() || null } : t))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.ticket_resolved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'staff', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number },
    })
    setResolutionNote('')
    setResolving(false)
  }

  async function handleSaveInternalNote() {
    if (!selectedId || !internalNote.trim()) return
    setSavingNote(true)
    await supabase.from('support_tickets').update({ internal_notes: internalNote.trim() }).eq('id', selectedId)
    setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, internal_notes: internalNote.trim() } : t))
    setSavingNote(false)
  }

  async function handleTransfer(targetDept: string) {
    if (!selectedId || !selected) return
    setTransferring(true)
    const { data: { user } } = await supabase.auth.getUser()
    const note = `[Management → ${targetDept}] Transferred by management on ${new Date().toLocaleDateString('en-NG')}`
    const merged = selected.internal_notes ? `${selected.internal_notes}\n${note}` : note
    await supabase.from('support_tickets').update({
      department: targetDept,
      status: 'in_progress',
      internal_notes: merged,
    }).eq('id', selectedId)
    await supabase.from('audit_logs').insert({
      event: 'ops.ticket_transferred', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'staff', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number, transferred_to: targetDept },
    })
    setTickets(prev => prev.map(t => t.id === selectedId
      ? { ...t, department: targetDept, status: 'in_progress', internal_notes: merged } : t))
    setTransferring(false)
  }

  async function handleAssign(assignTo: string, dept: string) {
    if (!selectedId) return
    await supabase.from('support_tickets').update({ assigned_to: assignTo, department: dept, status: 'in_progress' }).eq('id', selectedId)
    setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, assigned_to: assignTo, department: dept, status: 'in_progress' } : t))
  }

  async function handleCreateTicket() {
    if (!createForm.subject.trim() || !createForm.description.trim() || !createForm.submitter_email.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
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
      assigned_to: createForm.assigned_to || null,
      department: createForm.department || null,
      source: 'admin_created',
    }).select().single()
    if (!error && data) {
      await supabase.from('audit_logs').insert({
        event: 'admin.ticket_created', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
        actor_type: 'staff', target_id: (data as Ticket).id, target_type: 'support_ticket',
        target_name: createForm.subject, severity: 'info', app: 'admin_panel',
      })
      setShowCreate(false)
      setCreateForm({ submitter_name: '', submitter_email: '', submitter_type: 'candidate', subject: '', description: '', category: 'general', priority: 'normal', assigned_to: '', department: '' })
    }
    setCreating(false)
  }

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const newCount = tickets.filter(t => t.status === 'sent').length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Support Tickets"
        subtitle={`${tickets.length} total · ${newCount > 0 ? `${newCount} new` : 'none new'}`}
        actions={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Ticket
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[400px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {(['all','sent','in_progress','resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-ops-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s as TicketStatus]}
                  {s === 'sent' && newCount > 0 && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 rounded px-1">{newCount}</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all','urgent','high','normal','low'] as const).map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${priorityFilter === p ? 'bg-surface-border text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                  {p === 'all' ? 'All priority' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading tickets…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-sm">No tickets match this filter.</div>
            ) : filtered.map(t => {
              const sub = SUBMITTER_BADGE[t.submitter_type]
              const isActive = selectedId === t.id
              const pStyle = PRIORITY_STYLES[t.priority]
              return (
                <button key={t.id} onClick={() => handleSelectTicket(t.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${isActive ? 'bg-ops-900/40 border-l-2 border-l-ops-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}>{sub.label}</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{relativeTime(t.created_at)}</span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary mb-0.5 truncate">{t.subject}</p>
                  <p className="text-[11px] text-text-secondary mb-2 truncate">{t.submitter_name} · {t.submitter_email}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    <span className="flex items-center gap-1 text-[9px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />{pStyle.label}
                    </span>
                    <span className="text-[9px] text-text-muted">{CATEGORY_LABELS[t.category]}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p className="text-sm">Select a ticket to view details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-text-muted">{selected.ticket_number}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_STYLES[selected.priority].dot}`} />
                      {PRIORITY_STYLES[selected.priority].label}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
                  <p className="text-xs text-text-secondary mt-0.5">{selected.submitter_name} · {selected.submitter_email} · {formatTime(selected.created_at)}</p>
                </div>
                {selected.status !== 'resolved' && selected.status !== 'closed' && (
                  <button onClick={handleResolve} disabled={resolving}
                    className="px-4 py-2 rounded-lg bg-trust-high-bg text-trust-high border border-trust-high-border text-xs font-semibold hover:bg-green-900/30 disabled:opacity-50 transition-colors flex-shrink-0">
                    {resolving ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                )}
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Resolution Note <span className="text-text-muted font-normal normal-case">(optional)</span></p>
                  <textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                    placeholder="Describe how the issue was resolved…" rows={3}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
                </div>
              )}

              {selected.status === 'resolved' && selected.resolution_note && (
                <div className="bg-trust-high-bg border border-trust-high-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-trust-high uppercase tracking-wider mb-1">Resolution</p>
                  <p className="text-sm text-text-primary">{selected.resolution_note}</p>
                  {selected.resolved_at && <p className="text-xs text-text-muted mt-1">Resolved {formatTime(selected.resolved_at)}</p>}
                </div>
              )}

              {/* Route to department room */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Route to Department Room</p>
                  {selected.department && selected.department !== 'Management' && (
                    <span className="text-[10px] font-mono font-bold text-ops-400 bg-ops-500/10 border border-ops-500/30 px-2 py-0.5 rounded">
                      Routed → {selected.department}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mb-3">Transfer this issue to the right team to fix it. They will see it in their department inbox.</p>
                <div className="space-y-2">
                  {DEPT_ROOMS.map(({ dept, label, desc, color }) => {
                    const isActive = selected.department === dept
                    return (
                      <button key={dept} onClick={() => handleTransfer(dept)} disabled={transferring || isActive}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors disabled:opacity-50
                          ${isActive
                            ? `bg-${color}-500/15 border-${color}-500/40 cursor-default`
                            : `bg-surface-elevated border-surface-border hover:border-ops-500/40 hover:bg-ops-900/10`
                          }`}>
                        <div>
                          <p className={`text-xs font-semibold ${isActive ? `text-${color}-400` : 'text-text-primary'}`}>{label}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{desc}</p>
                        </div>
                        {isActive ? (
                          <span className={`text-[10px] font-bold text-${color}-400`}>Active</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Assign To Staff</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-secondary mb-1 block">Staff member</label>
                    <select value={selected.assigned_to ?? ''} onChange={e => handleAssign(e.target.value, selected.department ?? '')}
                      className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                      <option value="">Unassigned</option>
                      {STAFF_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary mb-1 block">Department</label>
                    <select value={selected.department ?? ''} onChange={e => handleAssign(selected.assigned_to ?? '', e.target.value)}
                      className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                      <option value="">No department</option>
                      {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Internal Notes <span className="text-text-muted font-normal normal-case">(not shown to user)</span></p>
                <textarea value={internalNote || selected.internal_notes || ''} onChange={e => setInternalNote(e.target.value)}
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Create Support Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-2">
                {(['candidate','company'] as const).map(t => (
                  <button key={t} onClick={() => setCreateForm(f => ({ ...f, submitter_type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${createForm.submitter_type === t ? 'bg-ops-500 text-white border-ops-500' : 'bg-surface-elevated text-text-secondary border-surface-border'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Name</label>
                  <input type="text" value={createForm.submitter_name} onChange={e => setCreateForm(f => ({ ...f, submitter_name: e.target.value }))} placeholder="User's name"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Email *</label>
                  <input type="email" value={createForm.submitter_email} onChange={e => setCreateForm(f => ({ ...f, submitter_email: e.target.value }))} placeholder="user@email.com"
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Subject *</label>
                <input type="text" value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))} placeholder="What is the issue about?"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Category</label>
                  <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value as TicketCategory }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    {Object.entries(PRIORITY_STYLES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Description *</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue…" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Assign to staff</label>
                  <select value={createForm.assigned_to} onChange={e => setCreateForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    <option value="">Unassigned</option>
                    {STAFF_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Department</label>
                  <select value={createForm.department} onChange={e => setCreateForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                    <option value="">No department</option>
                    {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                <button onClick={handleCreateTicket} disabled={creating || !createForm.subject.trim() || !createForm.description.trim() || !createForm.submitter_email.trim()}
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
