'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

interface AuditEntry {
  id: string
  event: string
  actor_email: string | null
  severity: string
  app: string | null
  created_at: string
}

interface Incident {
  id: string
  title: string
  severity: string
  status: string
  type: string | null
  created_at: string
}

const SEV_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
  error:    { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  warning:  { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)' },
  info:     { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.3)' },
  low:      { text: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
}

const STATUS_DOT: Record<string, string> = {
  open: '#EF4444', investigating: '#F97316', identified: '#FBBF24',
  monitoring: '#38BDF8', resolved: '#22C55E',
}

function timeDiff(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

export default function PerformancePage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [dbLatency, setDbLatency] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const t0 = Date.now()
    const [{ data: logData }, { data: incData }] = await Promise.all([
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    const latency = Date.now() - t0
    setDbLatency(latency)
    setLogs(logData ?? [])
    setIncidents((incData ?? []) as Incident[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [load])

  const now24 = Date.now() - 86_400_000
  const today = logs.filter(l => new Date(l.created_at).getTime() > now24)
  const critical24 = today.filter(l => l.severity === 'critical').length
  const warning24 = today.filter(l => l.severity === 'warning').length
  const info24 = today.filter(l => l.severity === 'info').length

  // Severity breakdown for bar chart
  const total = logs.length || 1
  const critCount = logs.filter(l => l.severity === 'critical').length
  const warnCount = logs.filter(l => l.severity === 'warning').length
  const infoCount = logs.filter(l => l.severity === 'info').length

  // Event frequency
  const eventFreq: Record<string, number> = {}
  logs.forEach(l => { eventFreq[l.event] = (eventFreq[l.event] ?? 0) + 1 })
  const topEvents = Object.entries(eventFreq).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const openIncidents = incidents.filter(i => i.status !== 'resolved')

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="System Performance" subtitle="DB metrics, audit events, and incident tracker" />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* KPI row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'DB Response Time', value: dbLatency !== null ? `${dbLatency}ms` : '—', color: dbLatency !== null && dbLatency < 200 ? '#34D399' : '#FBBF24' },
            { label: 'Events Today',     value: today.length.toString(),     color: '#38BDF8' },
            { label: 'Critical (24h)',   value: critical24.toString(),        color: '#F87171' },
            { label: 'Warnings (24h)',   value: warning24.toString(),         color: '#FBBF24' },
            { label: 'Info (24h)',       value: info24.toString(),            color: '#34D399' },
          ].map(kpi => (
            <div key={kpi.label} style={{ ...CARD_STYLE, padding: '18px 20px' }}>
              <p className="text-[11px] uppercase tracking-wide mb-1 font-semibold" style={{ color: 'var(--tx-3)' }}>{kpi.label}</p>
              <p className="text-[26px] font-bold font-display" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Severity breakdown */}
          <div style={{ ...CARD_STYLE, padding: '24px' }}>
            <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Severity Breakdown</h2>
            {loading ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p> : (
              <div className="space-y-3">
                {[
                  { label: 'Critical', count: critCount, color: '#F87171' },
                  { label: 'Warning',  count: warnCount, color: '#FBBF24' },
                  { label: 'Info',     count: infoCount, color: '#38BDF8' },
                ].map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--tx-2)' }}>{bar.label}</span>
                      <span className="text-[12px] font-mono" style={{ color: bar.color }}>{bar.count}</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((bar.count / total) * 100)}%`, backgroundColor: bar.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event frequency */}
          <div style={{ ...CARD_STYLE, padding: '24px' }}>
            <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Top Event Types</h2>
            {loading ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p> :
              topEvents.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No events yet.</p> :
              <div className="space-y-2">
                {topEvents.map(([evt, cnt]) => (
                  <div key={evt} className="flex justify-between items-center">
                    <span className="text-[12px] font-mono truncate max-w-[160px]" style={{ color: 'var(--tx-2)' }}>{evt}</span>
                    <span className="text-[12px] font-bold ml-2 flex-shrink-0" style={{ color: '#06B6D4' }}>{cnt}</span>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* Open incidents */}
          <div style={{ ...CARD_STYLE, padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-bold" style={{ color: 'var(--tx-1)' }}>Open Incidents</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: openIncidents.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', color: openIncidents.length > 0 ? '#F87171' : '#34D399' }}>
                {openIncidents.length} open
              </span>
            </div>
            {loading ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p> :
              openIncidents.length === 0 ? (
                <div className="flex flex-col items-center py-4">
                  <div className="text-[32px] mb-2">✓</div>
                  <p className="text-[13px]" style={{ color: '#34D399' }}>All clear</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {openIncidents.map(inc => {
                    const ss = SEV_STYLE[inc.severity] ?? SEV_STYLE['info']
                    return (
                      <div key={inc.id} className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: STATUS_DOT[inc.status] ?? '#9CA3AF' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--tx-1)' }}>{inc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold" style={{ color: ss.text, backgroundColor: ss.bg, borderColor: ss.border }}>{inc.severity}</span>
                            <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>{timeDiff(inc.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>

        {/* Audit log table */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--tx-1)' }}>Recent Audit Events</h2>
            <button onClick={() => void load()} className="text-[12px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No audit events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Event', 'Actor', 'Severity', 'App', 'Time'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 font-semibold text-[11px] uppercase tracking-wide" style={{ color: 'var(--tx-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 20).map(row => {
                    const ss = SEV_STYLE[row.severity] ?? SEV_STYLE['info']
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 pr-4 font-mono text-[12px] max-w-[200px] truncate" style={{ color: 'var(--tx-1)' }}>{row.event}</td>
                        <td className="py-2 pr-4" style={{ color: 'var(--tx-2)' }}>{row.actor_email ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color: ss.text, backgroundColor: ss.bg, borderColor: ss.border }}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[12px]" style={{ color: 'var(--tx-3)' }}>{row.app ?? '—'}</td>
                        <td className="py-2 text-[12px]" style={{ color: 'var(--tx-3)' }}>{timeDiff(row.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
