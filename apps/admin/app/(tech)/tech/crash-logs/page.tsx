'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface LogEntry {
  id: string
  event: string
  severity: string | null
  actor_email: string | null
  app: string | null
  created_at: string
  metadata?: Record<string, unknown>
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
type DateFilter = '7d' | '30d' | 'all'

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  warning:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  info:     { color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  error:    { color: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CrashLogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d')
  const [viewLog, setViewLog] = useState<LogEntry | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .or('event.ilike.error.%,event.ilike.crash.%,severity.eq.critical')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs((data ?? []) as LogEntry[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    intervalRef.current = setInterval(() => { void load() }, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  const now = Date.now()
  const cutoff = dateFilter === '7d' ? now - 7 * 86400000 : dateFilter === '30d' ? now - 30 * 86400000 : 0
  const filtered = logs.filter(l => {
    if (cutoff > 0 && new Date(l.created_at).getTime() < cutoff) return false
    if (sevFilter !== 'all' && l.severity !== sevFilter) return false
    return true
  })

  const week = logs.filter(l => new Date(l.created_at).getTime() > now - 7 * 86400000)
  const uniqueTypes = new Set(logs.map(l => l.event)).size
  const criticalCount = logs.filter(l => l.severity === 'critical').length
  const avgPerDay = week.length > 0 ? (week.length / 7).toFixed(1) : '0'

  // Group by day for bar chart
  const byDay: Record<string, number> = {}
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now - d * 86400000).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
    byDay[day] = 0
  }
  week.forEach(l => {
    const day = new Date(l.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
    if (day in byDay) byDay[day]++
  })
  const maxBarVal = Math.max(...Object.values(byDay), 1)

  // Top 10 event types
  const eventCounts: Record<string, number> = {}
  filtered.forEach(l => { eventCounts[l.event] = (eventCounts[l.event] ?? 0) + 1 })
  const topEvents = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const totalFiltered = filtered.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Crash & Error Logs" subtitle="Mobile app errors and critical events — auto-refreshes every 30s" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Errors (7 days)', value: week.length, color: '#F87171' },
            { label: 'Unique Error Types', value: uniqueTypes, color: '#A78BFA' },
            { label: 'Critical Errors', value: criticalCount, color: '#F87171' },
            { label: 'Avg Errors/Day', value: avgPerDay, color: '#FBBF24' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Daily frequency bar chart */}
          <div style={CARD} className="p-5">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 16 }}>Error Frequency (Last 7 Days)</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {Object.entries(byDay).map(([day, count]) => (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: `${(count / maxBarVal) * 60}px`, minHeight: 2, backgroundColor: count > 0 ? '#F87171' : 'var(--bg-surface)', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 9, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{day.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top error types */}
          <div style={CARD} className="p-5">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 16 }}>Top Error Types</h3>
            {topEvents.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>No errors logged</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topEvents.map(([evt, count]) => (
                  <div key={evt}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--tx-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{evt}</span>
                      <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{count}</span>
                    </div>
                    <div style={{ height: 4, backgroundColor: 'var(--bg-surface)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${(count / (topEvents[0][1] || 1)) * 100}%`, backgroundColor: '#A78BFA', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${sevFilter === s ? '#F59E0B' : 'var(--border)'}`, backgroundColor: sevFilter === s ? 'rgba(245,158,11,0.1)' : 'transparent', color: sevFilter === s ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
          {(['7d', '30d', 'all'] as DateFilter[]).map(d => (
            <button key={d} onClick={() => setDateFilter(d)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${dateFilter === d ? '#38BDF8' : 'var(--border)'}`, backgroundColor: dateFilter === d ? 'rgba(56,189,248,0.1)' : 'transparent', color: dateFilter === d ? '#38BDF8' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {d === 'all' ? 'All Time' : d === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx-3)' }}>{totalFiltered} events</span>
        </div>

        {/* Table */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No errors logged</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Event', 'Severity', 'User', 'App', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(l => {
                  const ss = SEV_STYLE[l.severity ?? ''] ?? SEV_STYLE.info
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--tx-1)', fontFamily: 'monospace', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.event}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ color: ss.color, backgroundColor: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{l.severity ?? 'info'}</span>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)' }}>{l.actor_email ?? '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)' }}>{l.app ?? '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(l.created_at)}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <button onClick={() => setViewLog(l)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Details</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {viewLog && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 440, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Error Details</h3>
                <button onClick={() => setViewLog(null)} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              {[
                { label: 'Event', value: viewLog.event },
                { label: 'Severity', value: viewLog.severity ?? 'info' },
                { label: 'User', value: viewLog.actor_email ?? '—' },
                { label: 'App', value: viewLog.app ?? '—' },
                { label: 'Date', value: formatDate(viewLog.created_at) },
                { label: 'ID', value: viewLog.id },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{row.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)', wordBreak: 'break-all', fontFamily: row.label === 'Event' || row.label === 'ID' ? 'monospace' : 'inherit' }}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
