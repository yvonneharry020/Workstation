'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type Severity = 'critical' | 'error' | 'warning' | 'info'

interface SecurityEvent {
  id: string
  created_at: string
  event: string
  actor_email: string | null
  actor_id: string | null
  actor_type: string | null
  severity: Severity
  ip_address: string | null
  metadata: Record<string, unknown> | null
  app: string | null
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-error/15 text-error border-error/30',
  error:    'bg-error/10 text-red-400 border-red-800/30',
  warning:  'bg-orange-900/20 text-orange-400 border-orange-800/30',
  info:     'bg-blue-900/20 text-blue-400 border-blue-800/30',
}

const SECURITY_EVENTS = [
  'user.login_failed',
  'admin.unauthorized_access',
  'user.suspicious_activity',
  'admin.permission_denied',
  'user.password_reset',
  'user.account_locked',
  'admin.force_logout',
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
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

const EMPTY: SecurityEvent[] = []

export default function SecurityEventsPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<SecurityEvent[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SecurityEvent | null>(null)

  useEffect(() => {
    async function load() {
      const query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (SECURITY_EVENTS.length > 0) {
        query.in('event', SECURITY_EVENTS)
      }

      const { data } = await query
      setEvents((data as SecurityEvent[] | null) ?? EMPTY)
      setLoading(false)
    }
    void load()
  }, [supabase])

  useEffect(() => {
    async function loadAll() {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .in('severity', ['critical', 'error', 'warning'])
        .order('created_at', { ascending: false })
        .limit(200)
      setEvents((data as SecurityEvent[] | null) ?? EMPTY)
      setLoading(false)
    }
    void loadAll()
  }, [supabase])

  const filtered = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.event.toLowerCase().includes(q) ||
        (e.actor_email ?? '').toLowerCase().includes(q) ||
        (e.actor_type ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const criticalCount = events.filter(e => e.severity === 'critical').length
  const errorCount = events.filter(e => e.severity === 'error').length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Security Events"
        subtitle={`${criticalCount > 0 ? `${criticalCount} critical · ` : ''}${errorCount > 0 ? `${errorCount} errors · ` : ''}${events.length} events total`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[420px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border space-y-2.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events, emails…"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-tech-500 focus:outline-none" />
            </div>
            <div className="flex gap-1.5">
              {(['all','critical','error','warning','info'] as const).map(s => (
                <button key={s} onClick={() => setSeverityFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${severityFilter === s ? 'bg-tech-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s}
                  {s === 'critical' && criticalCount > 0 && <span className="ml-1 text-[9px] bg-error/20 text-error rounded px-1">{criticalCount}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading security events…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                <p className="text-text-muted text-sm">No security events</p>
              </div>
            ) : filtered.map(e => {
              const isActive = selected?.id === e.id
              const sStyle = SEVERITY_STYLES[e.severity as Severity] ?? SEVERITY_STYLES.info
              return (
                <button key={e.id} onClick={() => setSelected(e)}
                  className={`w-full text-left px-4 py-3 transition-colors ${isActive ? 'bg-tech-900/40 border-l-2 border-l-tech-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${sStyle}`}>{e.severity}</span>
                    <span className="text-[9px] text-text-muted font-mono">{relativeTime(e.created_at)}</span>
                  </div>
                  <p className="text-xs font-mono text-text-primary truncate mb-0.5">{e.event}</p>
                  {e.actor_email && <p className="text-[11px] text-text-muted">{e.actor_email}</p>}
                  {e.ip_address && <p className="text-[10px] text-text-muted font-mono">{e.ip_address}</p>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p className="text-sm">Select an event to inspect</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${SEVERITY_STYLES[selected.severity as Severity] ?? SEVERITY_STYLES.info}`}>{selected.severity}</span>
                  {selected.app && <span className="text-[10px] text-text-muted font-mono">{selected.app}</span>}
                </div>
                <h2 className="text-base font-semibold text-text-primary font-mono">{selected.event}</h2>
                <p className="text-xs text-text-secondary mt-0.5">{formatTime(selected.created_at)}</p>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border divide-y divide-surface-border/50">
                {[
                  { label: 'Actor Email', value: selected.actor_email },
                  { label: 'Actor ID', value: selected.actor_id },
                  { label: 'Actor Type', value: selected.actor_type },
                  { label: 'IP Address', value: selected.ip_address },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-text-muted w-28 flex-shrink-0">{r.label}</span>
                    <span className="text-xs text-text-primary font-mono text-right break-all">{r.value}</span>
                  </div>
                ))}
              </div>

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Metadata</p>
                  <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
