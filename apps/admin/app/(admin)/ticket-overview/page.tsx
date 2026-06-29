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
  updated_at: string
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

const DEPT_BADGE: Record<string, string> = {
  Technical:  'bg-tech-500/15 text-tech-400 border-tech-500/30',
  Finance:    'bg-finance-500/15 text-finance-400 border-finance-500/30',
  Admin:      'bg-admin-500/15 text-admin-400 border-admin-500/30',
  Management: 'bg-ops-500/15 text-ops-400 border-ops-500/30',
}

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function TicketOverviewPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const ch = supabase.channel('ticket-overview')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (p) => {
        setTickets(prev => [p.new as Ticket, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (p) => {
        setTickets(prev => prev.map(t => t.id === (p.new as Ticket).id ? p.new as Ticket : t))
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  const selected = tickets.find(t => t.id === selectedId)

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (deptFilter !== 'all' && (t.department ?? 'Unassigned') !== deptFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!t.subject.toLowerCase().includes(q) && !t.submitter_name.toLowerCase().includes(q) && !t.submitter_email.toLowerCase().includes(q) && !(t.ticket_number ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const depts = Array.from(new Set(tickets.map(t => t.department ?? 'Unassigned'))).filter(Boolean)

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'sent').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Ticket Overview"
        subtitle={`${stats.total} total · ${stats.open} new · ${stats.inProgress} in progress · ${stats.resolved} resolved`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* List pane */}
        <div className="w-[420px] flex-shrink-0 border-r border-surface-border flex flex-col">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-surface-border space-y-2">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets, names, emails…"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none"
            />
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'sent', 'in_progress', 'resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s as TicketStatus]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setDeptFilter('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${deptFilter === 'all' ? 'text-text-primary bg-surface-border' : 'text-text-muted hover:text-text-secondary'}`}>
                All depts
              </button>
              {depts.map(d => (
                <button key={d} onClick={() => setDeptFilter(d)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${deptFilter === d ? 'text-text-primary bg-surface-border' : 'text-text-muted hover:text-text-secondary'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-sm">No tickets match this filter.</div>
            ) : filtered.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-3.5 transition-colors ${selectedId === t.id ? 'bg-admin-900/30 border-l-2 border-l-admin-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                    {t.department && (
                      <span className={`text-[9px] font-bold uppercase border px-1 py-0.5 rounded font-mono ${DEPT_BADGE[t.department] ?? 'bg-surface-elevated text-text-muted border-surface-border'}`}>
                        {t.department}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-text-muted">{relTime(t.created_at)}</span>
                </div>
                <p className="text-xs font-semibold text-text-primary mb-0.5 truncate">{t.subject}</p>
                <p className="text-[11px] text-text-secondary mb-2 truncate">{t.submitter_name} · {t.submitter_email}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-semibold uppercase border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  <span className="flex items-center gap-1 text-[9px] text-text-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />{t.priority}
                  </span>
                  {t.assigned_to && <span className="text-[9px] text-text-muted truncate max-w-[120px]">→ {t.assigned_to}</span>}
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
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p className="text-sm">Select a ticket to view full details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[11px] font-mono text-text-muted">{selected.ticket_number}</span>
                  <span className={`text-[10px] font-semibold uppercase border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[selected.priority]}`} />{selected.priority}
                  </span>
                  {selected.department && (
                    <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded font-mono ${DEPT_BADGE[selected.department] ?? 'bg-surface-elevated text-text-muted border-surface-border'}`}>
                      {selected.department}
                    </span>
                  )}
                  <span className="text-[9px] text-text-muted font-mono bg-surface-elevated px-1.5 py-0.5 rounded capitalize">{selected.source.replace('_', ' ')}</span>
                </div>
                <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
                <p className="text-xs text-text-secondary mt-0.5">{selected.submitter_name} · {selected.submitter_email}</p>
              </div>

              {/* Routing info */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Routing Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Assigned To</p>
                    <p className="text-sm text-text-primary">{selected.assigned_to ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Department</p>
                    <p className="text-sm text-text-primary">{selected.department ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Created</p>
                    <p className="text-sm text-text-primary">{fmtDate(selected.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Last Updated</p>
                    <p className="text-sm text-text-primary">{fmtDate(selected.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Resolution */}
              {selected.status === 'resolved' && (
                <div className="bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Resolution</p>
                  <p className="text-sm text-text-primary">{selected.resolution_note ?? 'No resolution note.'}</p>
                  {selected.resolved_at && <p className="text-xs text-text-muted mt-1">Resolved {fmtDate(selected.resolved_at)}</p>}
                </div>
              )}

              {/* Internal notes */}
              {selected.internal_notes && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Internal Notes</p>
                  <pre className="text-[11px] text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">{selected.internal_notes}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
