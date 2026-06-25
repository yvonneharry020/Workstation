'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FlaggedEvent {
  id: string
  event: string
  severity: string
  created_at: string
  actor_email: string | null
  actor_id: string | null
  actor_type: string | null
  metadata: Record<string, unknown>
}

interface Action {
  id: string
  label: string
  color: string
}

const ACTIONS: Action[] = [
  { id: 'warn', label: 'Warn User', color: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30 hover:bg-yellow-900/30' },
  { id: 'freeze', label: 'Freeze Account', color: 'bg-orange-900/20 text-orange-400 border-orange-800/30 hover:bg-orange-900/30' },
  { id: 'dismiss', label: 'Dismiss', color: 'bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400 border-red-800/40',
  error: 'bg-red-900/20 text-red-400 border-red-800/30',
  warning: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  info: 'bg-blue-900/10 text-blue-400 border-blue-800/20',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ModerationPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<FlaggedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase
      .from('audit_logs')
      .select('id,event,severity,created_at,actor_email,actor_id,actor_type,metadata')
      .in('severity', ['critical', 'error', 'warning'])
      .order('created_at', { ascending: false })
      .limit(60)
    setEvents((data ?? []) as FlaggedEvent[])
    setLoading(false)
  }

  async function takeAction(event: FlaggedEvent, action: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (action === 'dismiss') {
      setDismissed(prev => new Set(prev).add(event.id))
      return
    }
    const msg = action === 'warn' ? `Warning logged for ${event.actor_email ?? event.actor_id ?? 'user'}` : `Account freeze initiated for ${event.actor_email ?? event.actor_id ?? 'user'}`
    await supabase.from('audit_logs').insert({
      event: `admin.moderation_${action}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: event.actor_id ?? null,
      severity: 'info',
      app: 'admin_panel',
      metadata: { original_event: event.event, action },
    })
    setActionMsg(prev => ({ ...prev, [event.id]: msg }))
    setDismissed(prev => new Set(prev).add(event.id))
  }

  const visible = events.filter(e => !dismissed.has(e.id))

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Content Moderation</h1>
          <p className="text-sm text-text-secondary mt-0.5">Flagged audit events requiring manual review. Take action or dismiss.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{visible.length} items</span>
          <button onClick={load} className="px-3 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 max-w-3xl space-y-2">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-text-muted text-sm">No flagged events requiring action.</p>
          </div>
        ) : (
          visible.map(event => (
            <div key={event.id} className={`bg-surface-card border rounded-xl p-4 ${SEVERITY_COLORS[event.severity]?.includes('border') ? '' : 'border-surface-border'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${SEVERITY_COLORS[event.severity] ?? ''}`}>{event.severity}</span>
                    <p className="text-sm font-semibold text-text-primary font-mono">{event.event}</p>
                  </div>
                  {event.actor_email && <p className="text-xs text-text-muted mt-1">Actor: {event.actor_email}</p>}
                  <p className="text-xs text-text-muted mt-0.5">{formatDate(event.created_at)}</p>
                  {Object.keys(event.metadata).length > 0 && (
                    <p className="text-[10px] text-text-muted mt-1 font-mono truncate">{JSON.stringify(event.metadata).slice(0, 100)}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {ACTIONS.map(action => (
                    <button key={action.id} onClick={() => void takeAction(event, action.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${action.color}`}>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              {actionMsg[event.id] && (
                <div className="mt-3 bg-green-900/10 border border-green-800/20 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-green-400">{actionMsg[event.id]}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
