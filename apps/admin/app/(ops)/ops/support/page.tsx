'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Ticket {
  id: string
  title: string
  description: string
  status: string
  priority: string | null
  category: string | null
  submitted_by: string
  submitted_by_name: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  resolution: string | null
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  in_progress: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  resolved: 'bg-green-900/20 text-green-400 border-green-800/30',
}

function timeDiff(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function OpsTicketsPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolving, setResolving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }

  async function openTicket(t: Ticket) {
    setSelected(t)
    setResolution('')
    if (t.status === 'sent') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', t.id)
      setTickets(prev => prev.map(tk => tk.id === t.id ? { ...tk, status: 'in_progress' } : tk))
      setSelected({ ...t, status: 'in_progress' })
    }
  }

  async function resolveTicket(t: Ticket) {
    setResolving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('support_tickets').update({ status: 'resolved', resolution: resolution.trim() || null, resolved_at: new Date().toISOString(), assigned_to: user?.email ?? null }).eq('id', t.id)
    setTickets(prev => prev.map(tk => tk.id === t.id ? { ...tk, status: 'resolved', resolution: resolution.trim() || null } : tk))
    setSelected({ ...t, status: 'resolved', resolution: resolution.trim() || null })
    setResolving(false)
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)

  return (
    <div className="flex h-screen">
      <div className="w-80 flex-shrink-0 border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border">
          <p className="text-sm font-semibold text-text-primary">Support Tickets</p>
          <p className="text-xs text-text-muted mt-0.5">{tickets.filter(t => t.status === 'sent').length} unread</p>
        </div>
        <div className="px-3 py-2 border-b border-surface-border flex gap-1 flex-wrap">
          {['all','sent','in_progress','resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-ops-900/50 text-ops-300' : 'text-text-muted hover:text-text-primary'}`}>{s.replace('_',' ')}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? <div className="text-text-muted text-xs px-2 py-3">Loading…</div> :
            filtered.map(t => (
              <button key={t.id} onClick={() => void openTicket(t)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${selected?.id === t.id ? 'bg-ops-900/40 border border-ops-800/30' : 'hover:bg-surface-elevated'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">{t.title}</p>
                  {t.status === 'sent' && <span className="w-2 h-2 rounded-full bg-ops-500 flex-shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0 rounded border capitalize ${STATUS_COLORS[t.status] ?? ''}`}>{t.status.replace('_',' ')}</span>
                  <span className="text-[10px] text-text-muted">{timeDiff(t.created_at)}</span>
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${STATUS_COLORS[selected.status] ?? ''}`}>{selected.status.replace('_',' ')}</span>
                  {selected.category && <span className="text-xs text-text-muted capitalize">{selected.category}</span>}
                  <span className="text-xs text-text-muted">{timeDiff(selected.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-4 mb-4">
              <p className="text-sm text-text-secondary">{selected.description}</p>
              <p className="text-xs text-text-muted mt-3">Submitted by: <span className="text-text-primary">{selected.submitted_by_name ?? selected.submitted_by}</span></p>
              {selected.assigned_to && <p className="text-xs text-text-muted mt-0.5">Assigned to: <span className="text-text-primary">{selected.assigned_to}</span></p>}
            </div>

            {selected.resolution && (
              <div className="bg-green-900/10 border border-green-800/20 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Resolution</p>
                <p className="text-sm text-text-secondary">{selected.resolution}</p>
              </div>
            )}

            {selected.status !== 'resolved' && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Resolve Ticket</p>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} placeholder="Add a resolution note (optional)…" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500 resize-none mb-3" />
                <button onClick={() => void resolveTicket(selected)} disabled={resolving} className="px-5 py-2.5 bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                  {resolving ? 'Resolving…' : 'Mark Resolved'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select a ticket to view details
          </div>
        )}
      </div>
    </div>
  )
}
