'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type TicketStatus = 'sent' | 'in_progress' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

interface Ticket {
  id: string
  ticket_number: string
  created_at: string
  submitter_name: string
  submitter_email: string
  subject: string
  description: string
  category: string
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
  in_progress: 'bg-admin-500/15 text-admin-400 border-admin-500/30',
  resolved:    'bg-green-900/20 text-green-400 border-green-800/30',
  closed:      'bg-surface-muted text-text-muted border-surface-border',
}
const STATUS_LABELS: Record<TicketStatus, string> = {
  sent: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
}
const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: 'bg-text-muted', normal: 'bg-blue-400', high: 'bg-yellow-400', urgent: 'bg-red-400',
}
const REROUTE_DEPTS = ['Technical', 'Finance', 'Management'] as const

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function AdminInboxPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [internalNote, setInternalNote] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [rerouting, setRerouting] = useState(false)

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('department', 'Admin')
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const ch = supabase.channel('admin-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (p) => {
        const t = p.new as Ticket
        if (t.department === 'Admin') setTickets(prev => [t, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (p) => {
        const t = p.new as Ticket
        setTickets(prev =>
          t.department !== 'Admin'
            ? prev.filter(x => x.id !== t.id)
            : prev.map(x => x.id === t.id ? t : x)
        )
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  const selected = tickets.find(t => t.id === selectedId)
  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)
  const newCount = tickets.filter(t => t.status === 'sent').length

  async function handleSelect(id: string) {
    setSelectedId(id)
    setInternalNote('')
    setResolutionNote('')
    const t = tickets.find(x => x.id === id)
    if (!t || t.status !== 'sent') return
    await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', id)
    setTickets(prev => prev.map(x => x.id === id ? { ...x, status: 'in_progress' } : x))
  }

  async function handleSaveNote() {
    if (!selectedId || !internalNote.trim() || !selected) return
    setSavingNote(true)
    const merged = selected.internal_notes
      ? `${selected.internal_notes}\n[Admin] ${internalNote.trim()}`
      : `[Admin] ${internalNote.trim()}`
    await supabase.from('support_tickets').update({ internal_notes: merged }).eq('id', selectedId)
    setTickets(prev => prev.map(x => x.id === selectedId ? { ...x, internal_notes: merged } : x))
    setInternalNote('')
    setSavingNote(false)
  }

  async function handleResolve() {
    if (!selectedId || !selected) return
    setResolving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('support_tickets').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote.trim() || null,
    }).eq('id', selectedId)
    await supabase.from('audit_logs').insert({
      event: 'admin.inbox_ticket_resolved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number },
    })
    setTickets(prev => prev.map(x => x.id === selectedId
      ? { ...x, status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: resolutionNote.trim() || null } : x))
    setResolving(false)
  }

  async function handleReroute(targetDept: string) {
    if (!selectedId || !selected) return
    setRerouting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const note = `[Admin → ${targetDept}] Rerouted from Admin inbox on ${new Date().toLocaleDateString('en-NG')}`
    const merged = selected.internal_notes ? `${selected.internal_notes}\n${note}` : note
    await supabase.from('support_tickets').update({
      department: targetDept,
      internal_notes: merged,
    }).eq('id', selectedId)
    await supabase.from('audit_logs').insert({
      event: 'admin.ticket_rerouted', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number, rerouted_to: targetDept },
    })
    setTickets(prev => prev.filter(x => x.id !== selectedId))
    setSelectedId(null)
    setRerouting(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Admin Inbox"
        subtitle={`${tickets.length} tickets · ${newCount > 0 ? `${newCount} need attention` : 'all seen'}`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* List pane */}
        <div className="w-[360px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex gap-1.5 flex-wrap">
            {(['all', 'sent', 'in_progress', 'resolved'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                {s === 'all' ? 'All' : STATUS_LABELS[s as TicketStatus]}
                {s === 'sent' && newCount > 0 && <span className="ml-1 text-[9px] bg-error/20 text-error rounded px-1">{newCount}</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-elevated mx-auto mb-3 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <p className="text-sm text-text-muted">Admin inbox is clear</p>
                <p className="text-[11px] text-text-muted mt-1">Tickets routed to Admin will appear here</p>
              </div>
            ) : filtered.map(t => (
              <button key={t.id} onClick={() => handleSelect(t.id)}
                className={`w-full text-left px-4 py-3.5 transition-colors ${selectedId === t.id ? 'bg-admin-900/30 border-l-2 border-l-admin-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                  <span className="text-[9px] text-text-muted">{relTime(t.created_at)}</span>
                </div>
                <p className="text-xs font-semibold text-text-primary mb-0.5 truncate">{t.subject}</p>
                <p className="text-[11px] text-text-secondary mb-2 truncate">{t.submitter_name} · {t.submitter_email}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-semibold uppercase border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  <span className="flex items-center gap-1 text-[9px] text-text-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />{t.priority}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <p className="text-sm">Select a ticket to handle it</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-text-muted">{selected.ticket_number}</span>
                    <span className={`text-[10px] font-semibold uppercase border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[selected.priority]}`} />{selected.priority}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
                  <p className="text-xs text-text-secondary mt-0.5">{selected.submitter_name} · {selected.submitter_email} · {fmtTime(selected.created_at)}</p>
                </div>
                {selected.status !== 'resolved' && selected.status !== 'closed' && (
                  <button onClick={handleResolve} disabled={resolving}
                    className="px-4 py-2 rounded-lg bg-admin-500/20 text-admin-400 border border-admin-500/30 text-xs font-semibold hover:bg-admin-500/30 disabled:opacity-40 transition-colors flex-shrink-0">
                    {resolving ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Re-route to another dept */}
              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Re-route to Another Department</p>
                  <div className="flex gap-2">
                    {REROUTE_DEPTS.map(dept => (
                      <button key={dept} onClick={() => handleReroute(dept)} disabled={rerouting}
                        className="flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40
                          border-surface-border bg-surface-elevated text-text-secondary hover:border-admin-500/50 hover:text-admin-300">
                        {dept === 'Management' ? '← Management' : dept === 'Technical' ? 'Technical Room' : 'Finance Room'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution note */}
              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Resolution Note <span className="font-normal normal-case text-text-muted">(optional)</span></p>
                  <textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                    placeholder="How was this handled?…" rows={3}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none" />
                </div>
              )}

              {selected.status === 'resolved' && (
                <div className="bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Resolution</p>
                  <p className="text-sm text-text-primary">{selected.resolution_note ?? 'No resolution note.'}</p>
                  {selected.resolved_at && <p className="text-xs text-text-muted mt-1">Resolved {fmtTime(selected.resolved_at)}</p>}
                </div>
              )}

              {/* Internal notes */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Admin Notes <span className="font-normal normal-case text-text-muted">(private)</span></p>
                {selected.internal_notes && (
                  <pre className="text-[11px] text-text-secondary bg-surface-elevated rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap font-mono leading-relaxed border border-surface-border">{selected.internal_notes}</pre>
                )}
                <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)}
                  placeholder="Add a private admin note…" rows={2}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none mb-2" />
                <button onClick={handleSaveNote} disabled={savingNote || !internalNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-admin-500/20 text-admin-400 border border-admin-500/30 text-xs font-semibold hover:bg-admin-500/30 disabled:opacity-40 transition-colors">
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
