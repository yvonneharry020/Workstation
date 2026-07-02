'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createTabClient } from '@/lib/supabase/tab-client'

type TicketStatus = 'sent' | 'in_progress' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

interface Ticket {
  id: string
  ticket_number: string
  created_at: string
  subject: string
  description: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  resolved_at: string | null
  resolution_note: string | null
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  sent:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  in_progress: 'bg-ops-500/15 text-ops-400 border-ops-500/30',
  resolved:    'bg-green-900/20 text-green-400 border-green-800/30',
  closed:      'bg-surface-elevated text-text-muted border-surface-border',
}
const STATUS_LABELS: Record<TicketStatus, string> = {
  sent: 'Sent', in_progress: 'Admin Reviewing', resolved: 'Resolved', closed: 'Closed',
}
const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: 'bg-text-muted', normal: 'bg-blue-400', high: 'bg-yellow-400', urgent: 'bg-red-400',
}
const CATEGORIES = [
  { value: 'general',  label: 'General Query' },
  { value: 'account',  label: 'Access Issue' },
  { value: 'technical',label: 'Technical Problem' },
  { value: 'other',    label: 'Policy / Other' },
] as const
type TicketCategory = typeof CATEGORIES[number]['value']

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

export default function OpsAdminInboxPage() {
  const supabase = useMemo(() => createTabClient(), [])
  const [myTickets, setMyTickets]   = useState<Ticket[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [sending, setSending]       = useState(false)
  const [form, setForm] = useState({
    subject: '', description: '', category: 'general' as TicketCategory, priority: 'normal' as TicketPriority,
  })

  const fetchMyTickets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('department', 'Admin')
      .eq('submitter_email', user.email)
      .order('created_at', { ascending: false })
    if (data) setMyTickets(data as Ticket[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchMyTickets() }, [fetchMyTickets])

  useEffect(() => {
    const ch = supabase.channel('ops-admin-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void fetchMyTickets())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, fetchMyTickets])

  async function handleSend() {
    if (!form.subject.trim() || !form.description.trim()) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    const ticketNum = `ADMIN-${Date.now().toString().slice(-6)}`
    const { data } = await supabase.from('support_tickets').insert({
      ticket_number:   ticketNum,
      subject:         form.subject.trim(),
      description:     form.description.trim(),
      category:        form.category,
      priority:        form.priority,
      department:      'Admin',
      status:          'sent',
      submitter_type:  'admin',
      submitter_name:  user.email?.split('@')[0] ?? 'Staff',
      submitter_email: user.email,
      submitted_by:    user.id,
      source:          'admin_created',
    }).select().single()

    if (data) {
      setMyTickets(prev => [data as Ticket, ...prev])
      setForm({ subject: '', description: '', category: 'general', priority: 'normal' })
      setShowCompose(false)
      setSelectedId((data as Ticket).id)
    }
    setSending(false)
  }

  const selected = myTickets.find(t => t.id === selectedId)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Admin Inbox"
        subtitle="Send a message directly to the admin team"
        actions={
          <button onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Message
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* List pane */}
        <div className="w-[340px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-xs text-text-muted">Your messages to admin — {myTickets.length} total</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
            ) : myTickets.length === 0 ? (
              <div className="py-14 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-surface-elevated mx-auto mb-3 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">No messages yet</p>
                <p className="text-xs text-text-muted">Use the Admin Inbox to raise queries, access issues, or anything you need from the admin team.</p>
              </div>
            ) : myTickets.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-3.5 transition-colors ${selectedId === t.id ? 'bg-ops-900/30 border-l-2 border-l-ops-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-mono text-text-muted">{t.ticket_number}</span>
                  <span className="text-[9px] text-text-muted">{relTime(t.created_at)}</span>
                </div>
                <p className="text-xs font-semibold text-text-primary mb-1 truncate">{t.subject}</p>
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
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20 text-ops-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <p className="text-sm text-text-muted">Select a message to view its status</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-text-muted">{selected.ticket_number}</span>
                <span className={`text-[10px] font-semibold uppercase border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[selected.priority]}`} />{selected.priority}
                </span>
              </div>
              <h2 className="text-base font-semibold text-text-primary">{selected.subject}</h2>
              <p className="text-xs text-text-secondary">{selected.category} · Sent {fmtTime(selected.created_at)}</p>

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Message</p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.status === 'resolved' && (
                <div className="bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Admin Response</p>
                  <p className="text-sm text-text-primary">{selected.resolution_note ?? 'Admin resolved this message.'}</p>
                  {selected.resolved_at && <p className="text-xs text-text-muted mt-1">Resolved {fmtTime(selected.resolved_at)}</p>}
                </div>
              )}

              {selected.status === 'in_progress' && (
                <div className="bg-ops-900/10 border border-ops-800/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-ops-400 mb-1">Admin is reviewing this message</p>
                  <p className="text-xs text-text-muted">You'll see their response here once they've handled it.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCompose(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">New Message to Admin</h2>
              <button onClick={() => setShowCompose(false)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.category === c.value ? 'bg-ops-500 text-white border-ops-500' : 'bg-surface-elevated border-surface-border text-text-secondary'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Priority</label>
                <div className="flex gap-2">
                  {(['low','normal','high','urgent'] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${form.priority === p ? 'bg-ops-500/20 text-ops-300 border-ops-500/40' : 'bg-surface-elevated border-surface-border text-text-secondary'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Subject *</label>
                <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief summary of your message"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Message *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your query or issue in detail…" rows={5}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCompose(false)} className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                <button onClick={handleSend} disabled={sending || !form.subject.trim() || !form.description.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                  {sending ? 'Sending…' : 'Send to Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
