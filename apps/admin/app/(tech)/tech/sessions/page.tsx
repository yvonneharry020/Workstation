'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface SessionEntry {
  id: string
  actor_email: string | null
  actor_id: string | null
  actor_type: string | null
  app: string | null
  created_at: string
  metadata: Record<string, unknown>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function timeDiff(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export default function SessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase
      .from('audit_logs')
      .select('id,actor_email,actor_id,actor_type,app,created_at,metadata')
      .eq('event', 'auth.login')
      .order('created_at', { ascending: false })
      .limit(50)
    setSessions((data ?? []) as SessionEntry[])
    setLoading(false)
  }

  const APP_COLORS: Record<string, string> = {
    admin_panel: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
    candidate_app: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
    company_app: 'bg-tech-900/20 text-tech-400 border-tech-800/30',
  }

  const grouped = sessions.reduce<Record<string, SessionEntry[]>>((acc, s) => {
    const key = s.actor_email ?? s.actor_id ?? 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Active Sessions</h1>
          <p className="text-sm text-text-secondary mt-0.5">Recent login events from the audit log. Grouped by user.</p>
        </div>
        <button onClick={load} className="px-3 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
      </div>

      <div className="px-8 py-6 max-w-4xl">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">No recent login sessions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([email, userSessions]) => {
              const latest = userSessions[0]
              return (
                <div key={email} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-tech-900/50 flex items-center justify-center flex-shrink-0">
                        <span className="text-tech-300 text-xs font-bold">{email[0]?.toUpperCase() ?? '?'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{email}</p>
                        <p className="text-[10px] text-text-muted capitalize">{latest.actor_type ?? 'user'} · Last seen {timeDiff(latest.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{userSessions.length} session{userSessions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-surface-border">
                    {userSessions.slice(0, 3).map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-tech-400 flex-shrink-0" />
                          <span className="text-xs text-text-secondary font-mono">{s.id.slice(0, 8)}…</span>
                          {s.app && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${APP_COLORS[s.app] ?? 'bg-surface-elevated text-text-muted border-surface-border'}`}>{s.app.replace(/_/g, ' ')}</span>}
                        </div>
                        <span className="text-xs text-text-muted">{formatDate(s.created_at)}</span>
                      </div>
                    ))}
                    {userSessions.length > 3 && (
                      <div className="px-4 py-2 text-[10px] text-text-muted">+{userSessions.length - 3} more sessions</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
