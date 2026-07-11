'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

type Severity = 'info' | 'warning' | 'critical'
type AppFilter = 'all' | 'candidate_app' | 'company_app' | 'admin_panel'
type SeverityFilter = 'all' | Severity

interface AuditLog {
  id: string
  created_at: string
  event: string
  actor_id: string | null
  actor_email: string | null
  actor_type: string
  target_id: string | null
  target_type: string | null
  target_name: string | null
  severity: Severity
  metadata: Record<string, unknown>
  ip_address: string | null
  app: string
}

const APP_LABELS: Record<string, { label: string; color: string }> = {
  candidate_app:  { label: 'Candidate App',  color: '#0DD4C3' },
  company_app:    { label: 'Company App',     color: '#F59E0B' },
  admin_panel:    { label: 'Admin Panel',     color: '#A855F7' },
  system:         { label: 'System',          color: '#475569' },
  unknown:        { label: 'Unknown',         color: '#475569' },
}

const SEVERITY_STYLES: Record<Severity, string> = {
  info:     'bg-surface-muted text-text-secondary border-surface-border',
  warning:  'bg-warning/15 text-warning border-warning/30',
  critical: 'bg-error/15 text-error border-error/30',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function humanizeEvent(event: string) {
  return event.replace(/\./g, ' › ').replace(/_/g, ' ')
}

function exportToCsv(rows: AuditLog[]) {
  const cols = ['Time', 'App', 'Event', 'Actor', 'Actor Type', 'Target', 'Severity', 'IP']
  const lines = [
    cols.join(','),
    ...rows.map(r => [
      `"${formatTime(r.created_at)}"`,
      `"${r.app}"`,
      `"${r.event}"`,
      `"${r.actor_email ?? r.actor_id ?? ''}"`,
      `"${r.actor_type}"`,
      `"${r.target_name ?? r.target_id ?? ''}"`,
      `"${r.severity}"`,
      `"${r.ip_address ?? ''}"`,
    ].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [appFilter, setAppFilter] = useState<AppFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [search, setSearch] = useState('')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const fetchLogs = useCallback(async () => {
    const supabase = createClient()
    const query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    const { data } = await query
    if (data) setLogs(data as AuditLog[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs, lastRefresh])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => setLastRefresh(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const filtered = logs.filter(l => {
    if (appFilter !== 'all' && l.app !== appFilter) return false
    if (severityFilter !== 'all' && l.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        l.event.toLowerCase().includes(q) ||
        (l.actor_email ?? '').toLowerCase().includes(q) ||
        (l.target_name ?? '').toLowerCase().includes(q) ||
        (l.actor_type ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const criticalCount = logs.filter(l => l.severity === 'critical').length
  const warningCount  = logs.filter(l => l.severity === 'warning').length

  const appBreakdown = Object.entries(
    logs.reduce<Record<string, number>>((acc, l) => {
      const key = l.app || 'unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  ).sort(([, a], [, b]) => b - a)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Audit Log"
        subtitle={`${logs.length} events · auto-refreshes every 30s`}
        actions={
          <button
            onClick={() => exportToCsv(filtered)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary text-sm font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        }
      />

      <div className="px-8 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Events',   value: logs.length,         color: 'text-text-primary' },
            { label: 'Critical',       value: criticalCount,       color: 'text-error' },
            { label: 'Warnings',       value: warningCount,        color: 'text-warning' },
            { label: 'Showing',        value: filtered.length,     color: 'text-admin-300' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl px-5 py-4">
              <p className="text-xs text-text-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* App breakdown */}
        {appBreakdown.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Events by Source</p>
            <div className="flex items-end gap-4 flex-wrap">
              {appBreakdown.map(([app, count]) => {
                const meta = APP_LABELS[app] ?? { label: app, color: '#475569' }
                const pct = logs.length > 0 ? Math.round((count / logs.length) * 100) : 0
                return (
                  <div key={app} className="flex flex-col items-center gap-1 min-w-[64px]">
                    <span className="text-xs font-bold font-mono" style={{ color: meta.color }}>{count}</span>
                    <div className="w-10 rounded-t overflow-hidden bg-surface-elevated" style={{ height: 32 }}>
                      <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: meta.color, opacity: 0.7, marginTop: 'auto' }} />
                    </div>
                    <span className="text-[10px] text-text-muted text-center leading-tight">{meta.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events, actors, targets…"
              className="bg-surface-card border border-surface-border rounded-lg pl-8 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none w-72"
            />
          </div>
          {/* App filter */}
          <div className="flex gap-1.5">
            {(['all','candidate_app','company_app','admin_panel'] as AppFilter[]).map(a => (
              <button key={a} onClick={() => setAppFilter(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${appFilter === a ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                {a === 'all' ? 'All Apps' : APP_LABELS[a]?.label ?? a}
              </button>
            ))}
          </div>
          {/* Severity filter */}
          <div className="flex gap-1.5">
            {(['all','info','warning','critical'] as SeverityFilter[]).map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${severityFilter === s ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => setLastRefresh(Date.now())} className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  {['Time','App','Event','Actor','Target','Severity','IP'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-text-muted text-sm">Loading audit events…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <p className="text-text-muted text-sm mb-1">No events yet</p>
                      <p className="text-text-muted text-xs">Events from all apps will appear here as they happen.</p>
                    </td>
                  </tr>
                ) : filtered.map(log => {
                  const appMeta = APP_LABELS[log.app] ?? APP_LABELS.unknown
                  return (
                    <tr key={log.id} className={`hover:bg-surface-elevated/40 transition-colors ${log.severity === 'critical' ? 'bg-error/5' : log.severity === 'warning' ? 'bg-warning/5' : ''}`}>
                      <td className="px-4 py-3 font-mono text-[11px] text-text-muted whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${appMeta.color}20`, color: appMeta.color }}>
                          {appMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-primary">{humanizeEvent(log.event)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-text-primary truncate max-w-[160px]">{log.actor_email ?? log.actor_id ?? '—'}</p>
                        <p className="text-[10px] text-text-muted capitalize">{log.actor_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        {log.target_name || log.target_id ? (
                          <>
                            <p className="text-xs text-text-primary truncate max-w-[140px]">{log.target_name ?? log.target_id}</p>
                            {log.target_type && <p className="text-[10px] text-text-muted capitalize">{log.target_type}</p>}
                          </>
                        ) : <span className="text-text-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${SEVERITY_STYLES[log.severity]}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-text-muted">{log.ip_address ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
