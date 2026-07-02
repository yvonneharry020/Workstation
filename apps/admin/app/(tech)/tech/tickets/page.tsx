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
  resolved_by_email: string | null
  parent_ticket_id: string | null
  escalation_raised: boolean
  escalation_raised_at: string | null
  escalation_raised_by: string | null
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  sent:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  in_progress: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  resolved:    'bg-green-900/20 text-green-400 border-green-800/30',
  closed:      'bg-surface-muted text-text-muted border-surface-border',
}
const STATUS_LABELS: Record<TicketStatus, string> = {
  sent: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
}
const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: 'bg-text-muted', normal: 'bg-blue-400', high: 'bg-yellow-400', urgent: 'bg-red-400',
}

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

export default function TechTicketsPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [internalNote, setInternalNote] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [returning, setReturning] = useState(false)

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('department', 'Technical')
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const ch = supabase.channel('tech-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (p) => {
        const t = p.new as Ticket
        if (t.department === 'Technical') setTickets(prev => [t, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (p) => {
        const t = p.new as Ticket
        setTickets(prev =>
          t.department !== 'Technical'
            ? prev.filter(x => x.id !== t.id)
            : prev.map(x => x.id === t.id ? t : x)
        )
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  const selected = tickets.find(t => t.id === selectedId)
  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)
  const openCount = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length

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
      ? `${selected.internal_notes}\n[Tech] ${internalNote.trim()}`
      : `[Tech] ${internalNote.trim()}`
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
      resolved_by_email: user?.email ?? null,
    }).eq('id', selectedId)
    await supabase.from('audit_logs').insert({
      event: 'tech.ticket_resolved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number },
    })
    setTickets(prev => prev.map(x => x.id === selectedId
      ? { ...x, status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: resolutionNote.trim() || null } : x))
    setResolving(false)
  }

  async function handleReturnToManagement() {
    if (!selectedId || !selected) return
    setReturning(true)
    const { data: { user } } = await supabase.auth.getUser()
    const note = `[Tech → Management] Returned to management on ${new Date().toLocaleDateString('en-NG')}`
    const merged = selected.internal_notes ? `${selected.internal_notes}\n${note}` : note
    await supabase.from('support_tickets').update({
      department: 'Management',
      internal_notes: merged,
    }).eq('id', selectedId)
    await supabase.from('audit_logs').insert({
      event: 'tech.ticket_returned', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: selectedId, target_type: 'support_ticket',
      target_name: selected.subject, severity: 'info', app: 'admin_panel',
      metadata: { ticket_number: selected.ticket_number, returned_to: 'Management' },
    })
    setTickets(prev => prev.filter(x => x.id !== selectedId))
    setSelectedId(null)
    setReturning(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Technical Tickets"
        subtitle={`${tickets.length} assigned · ${openCount} open`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* List pane */}
        <div className="w-[360px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex gap-1.5 flex-wrap">
            {(['all', 'sent', 'in_progress', 'resolved'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-tech-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                {s === 'all' ? 'All' : STATUS_LABELS[s as TicketStatus]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-elevated mx-auto mb-3 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p className="text-sm text-text-muted">No tickets here</p>
                <p className="text-[11px] text-text-muted mt-1">Management will route issues here</p>
              </div>
            ) : filtered.map(t => {
              const isEscalated = t.escalation_raised && t.status !== 'resolved'
              return (
                <button key={t.id} onClick={() => handleSelect(t.id)}
                  className={`w-full text-left px-4 py-3.5 relative transition-colors
                    ${isEscalated
                      ? 'border-l-2 border-l-red-500 bg-red-500/5 animate-pulse'
                      : selectedId === t.id
                        ? 'bg-tech-900/30 border-l-2 border-l-tech-500'
                        : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'
                    }`}>
                  {isEscalated && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded px-1.5 py-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span className="text-[9px] font-bold text-red-400">URGENT</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                    <span className="text-[9px] text-text-muted">{relTime(t.created_at)}</span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary mb-0.5 truncate pr-16">{t.subject}</p>
                  <p className="text-[11px] text-text-secondary mb-2 truncate">{t.submitter_name} · {t.submitter_email}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold uppercase border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    <span className="flex items-center gap-1 text-[9px] text-text-muted">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />{t.priority}
                    </span>
                    <span className="text-[9px] text-text-muted capitalize">{t.category}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p className="text-sm">Select a ticket to start working on it</p>
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
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={handleReturnToManagement} disabled={returning}
                    className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">
                    {returning ? 'Returning…' : '← Return to Mgmt'}
                  </button>
                  {selected.status !== 'resolved' && selected.status !== 'closed' && (
                    <button onClick={handleResolve} disabled={resolving}
                      className="px-3 py-1.5 rounded-lg bg-tech-500/20 text-tech-400 border border-tech-500/30 text-xs font-semibold hover:bg-tech-500/30 disabled:opacity-40 transition-colors">
                      {resolving ? 'Resolving…' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Issue Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Resolution Note <span className="font-normal normal-case text-text-muted">(optional)</span></p>
                  <textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)}
                    placeholder="Describe how you fixed the issue…" rows={3}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-tech-500 focus:outline-none resize-none" />
                </div>
              )}

              {selected.status === 'resolved' && selected.resolution_note && (
                <div className="bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Resolution</p>
                  <p className="text-sm text-text-primary">{selected.resolution_note}</p>
                  {selected.resolved_at && <p className="text-xs text-text-muted mt-1">Resolved {fmtTime(selected.resolved_at)}</p>}
                </div>
              )}

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Team Notes <span className="font-normal normal-case text-text-muted">(internal)</span></p>
                {selected.internal_notes && (
                  <pre className="text-[11px] text-text-secondary bg-surface-elevated rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap font-mono leading-relaxed border border-surface-border">{selected.internal_notes}</pre>
                )}
                <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)}
                  placeholder="Add a technical note…" rows={2}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-tech-500 focus:outline-none resize-none mb-2" />
                <button onClick={handleSaveNote} disabled={savingNote || !internalNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-tech-500/20 text-tech-400 border border-tech-500/30 text-xs font-semibold hover:bg-tech-500/30 disabled:opacity-40 transition-colors">
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
