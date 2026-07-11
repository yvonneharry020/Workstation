'use client'

import { useState, useEffect, useRef } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface AuditEntry {
  id: string
  event: string
  severity: string
  created_at: string
  actor_email: string | null
  actor_type: string | null
  app: string | null
  metadata: Record<string, unknown>
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-800/30', label: 'CRIT' },
  error: { bg: 'bg-red-900/15', text: 'text-red-300', border: 'border-red-800/20', label: 'ERR' },
  warning: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-800/30', label: 'WARN' },
  info: { bg: 'bg-blue-900/10', text: 'text-blue-400', border: 'border-blue-800/20', label: 'INFO' },
}

const ALL_SEVERITIES = ['critical', 'error', 'warning', 'info'] as const

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ErrorFeedPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [filter, setFilter] = useState<Set<string>>(new Set(['critical', 'error', 'warning']))
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)
  const [search, setSearch] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!live) return
    const channel = supabase.channel('error-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        const entry = payload.new as AuditEntry
        if (['critical', 'error', 'warning', 'info'].includes(entry.severity)) {
          setEntries(prev => [entry, ...prev].slice(0, 200))
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [live, supabase])

  async function loadInitial() {
    const { data } = await supabase
      .from('audit_logs')
      .select('id,event,severity,created_at,actor_email,actor_type,app,metadata')
      .in('severity', ['critical', 'error', 'warning', 'info'])
      .order('created_at', { ascending: false })
      .limit(100)
    setEntries((data ?? []) as AuditEntry[])
    setLoading(false)
  }

  function toggleSeverity(s: string) {
    setFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const filtered = entries.filter(e =>
    filter.has(e.severity) &&
    (search === '' || e.event.toLowerCase().includes(search.toLowerCase()) || (e.actor_email ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-screen">
      <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Error Feed</h1>
          <p className="text-xs text-text-secondary mt-0.5">Real-time stream of error and warning events from the audit log.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLive(l => !l)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${live ? 'bg-tech-900/40 border-tech-700/40 text-tech-300' : 'bg-surface-elevated border-surface-border text-text-muted'}`}>
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-tech-400 animate-pulse' : 'bg-surface-border'}`} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button onClick={loadInitial} className="px-3 py-1.5 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </div>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-4 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events…"
          className="w-72 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-tech-500 font-mono"
        />
        <div className="flex items-center gap-2">
          {ALL_SEVERITIES.map(s => {
            const c = SEVERITY_CONFIG[s]
            return (
              <button key={s} onClick={() => toggleSeverity(s)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${filter.has(s) ? `${c.bg} ${c.text} ${c.border}` : 'bg-surface-elevated text-text-muted border-surface-border'}`}>
                {c.label}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-text-muted ml-auto">{filtered.length} events</span>
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">No events match the current filters.</p>
          </div>
        ) : (
          <div className="font-mono text-sm space-y-px">
            {filtered.map(entry => {
              const c = SEVERITY_CONFIG[entry.severity] ?? SEVERITY_CONFIG.info
              return (
                <div key={entry.id} className={`flex items-start gap-3 px-3 py-2 rounded border ${c.bg} ${c.border}`}>
                  <span className={`flex-shrink-0 w-10 text-[10px] font-black ${c.text}`}>{c.label}</span>
                  <span className="text-[10px] text-text-muted flex-shrink-0 w-36 pt-px">{formatTime(entry.created_at)}</span>
                  <span className={`flex-1 text-xs leading-snug ${c.text}`}>{entry.event}</span>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{entry.actor_email ?? entry.actor_type ?? 'system'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
