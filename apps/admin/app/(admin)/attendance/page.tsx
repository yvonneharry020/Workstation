'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import {
  formatDuration, formatNaira, computeSessionPay, statusLabel,
} from '@/lib/clock-utils'
import {
  Clock, CheckCircle, AlertCircle, Coffee, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'

interface ClockEvent {
  id: string
  event_type: string
  event_time: string
  metadata: Record<string, unknown> | null
}

interface ClockSession {
  id: string
  staff_email: string
  staff_full_name: string
  status: string
  session_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  current_interval_started_at: string | null
  total_worked_seconds: number
  total_break_seconds: number
  overtime_seconds: number
  overtime_approved: boolean
  overtime_approved_by: string | null
  hourly_rate_naira: number
  standard_work_seconds: number
  last_heartbeat_at: string | null
  clock_events: ClockEvent[]
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:          { label: 'Working',        dot: '#10B981', bg: '#10B98115', text: '#10B981' },
  on_break:        { label: 'On Break',       dot: '#F59E0B', bg: '#F59E0B15', text: '#F59E0B' },
  completed:       { label: 'Clocked Out',    dot: 'var(--tx-3)', bg: 'var(--bg-elevated)', text: 'var(--tx-3)' },
  auto_logged_out: { label: 'Auto Logged Out',dot: '#EF4444', bg: '#EF444415', text: '#EF4444' },
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function isOnline(session: ClockSession): boolean {
  if (!['active', 'on_break'].includes(session.status)) return false
  if (!session.last_heartbeat_at) return false
  const stale = (Date.now() - new Date(session.last_heartbeat_at).getTime()) / 1000
  return stale < 90
}

function computeLiveWorked(session: ClockSession): number {
  const base = session.total_worked_seconds
  if (session.status !== 'active' || !session.current_interval_started_at) return base
  return base + Math.max(0, Math.floor(
    (Date.now() - new Date(session.current_interval_started_at).getTime()) / 1000
  ))
}

function computeLiveBreak(session: ClockSession): number {
  const base = session.total_break_seconds
  if (session.status !== 'on_break' || !session.current_interval_started_at) return base
  return base + Math.max(0, Math.floor(
    (Date.now() - new Date(session.current_interval_started_at).getTime()) / 1000
  ))
}

export default function AttendancePage() {
  const [sessions,     setSessions]     = useState<ClockSession[]>([])
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading,      setLoading]      = useState(true)
  const [approving,    setApproving]    = useState<string | null>(null)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [, setTick]                     = useState(0)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/attendance?date=${selectedDate}`)
      const json = await res.json() as { sessions: ClockSession[] }
      setSessions(json.sessions ?? [])
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { void loadSessions() }, [loadSessions])

  // Live tick for running timers — fires for active work and on-break sessions
  useEffect(() => {
    const hasRunning = sessions.some(s => s.status === 'active' || s.status === 'on_break')
    if (!hasRunning) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [sessions])

  // Supabase Realtime for live session updates
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel('attendance-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clock_sessions', filter: `session_date=eq.${selectedDate}` },
        () => void loadSessions(),
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [selectedDate, loadSessions])

  async function approveOvertime(sessionId: string, approved: boolean) {
    setApproving(sessionId)
    try {
      await fetch(`/api/clock/overtime/${sessionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ approved }),
      })
      await loadSessions()
    } finally {
      setApproving(null)
    }
  }

  const onlineCount  = sessions.filter(s => isOnline(s)).length
  const breakCount   = sessions.filter(s => s.status === 'on_break').length
  const doneCount    = sessions.filter(s => s.status === 'completed').length
  const alertCount   = sessions.filter(s => s.status === 'auto_logged_out').length

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
              Attendance Records
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              Real-time clock-in status, shift logs, and payroll data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13px] font-medium border"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor:     'var(--border)',
                color:           'var(--tx-1)',
              }}
            />
            <button
              onClick={() => void loadSessions()}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tx-1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tx-3)' }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-3 mt-4">
          <StatusPill icon={<Clock size={12} />} label="Working" value={onlineCount} color="#10B981" />
          <StatusPill icon={<Coffee size={12} />} label="On Break" value={breakCount} color="#F59E0B" />
          <StatusPill icon={<CheckCircle size={12} />} label="Done" value={doneCount} color="var(--tx-3)" />
          <StatusPill icon={<AlertCircle size={12} />} label="Auto Logout" value={alertCount} color="#EF4444" />
        </div>
      </div>

      {/* Sessions table */}
      <div className="flex-1 px-8 py-6">
        {loading ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <Empty date={selectedDate} />
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const cfg         = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.completed
              const online      = isOnline(session)
              const liveWorked  = computeLiveWorked(session)
              const liveBreak   = computeLiveBreak(session)
              const { totalPay, overtimePay } = computeSessionPay(
                liveWorked,
                session.overtime_seconds,
                session.overtime_approved,
                session.hourly_rate_naira,
              )
              const hasOvertime = session.overtime_seconds > 0
              const isExpanded  = expanded === session.id

              return (
                <div
                  key={session.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border:          `1px solid var(--border)`,
                    boxShadow:       'var(--shadow-card)',
                  }}
                >
                  {/* Main row */}
                  <div className="px-5 py-4 flex items-center gap-4">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white"
                        style={{ backgroundColor: '#6366F1' }}
                      >
                        {session.staff_full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--tx-1)' }}>
                            {session.staff_full_name || session.staff_email}
                          </p>
                          {/* Online/Offline badge */}
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0"
                            style={{
                              backgroundColor: online ? '#10B98115' : 'var(--bg-elevated)',
                              color:           online ? '#10B981'   : 'var(--tx-3)',
                              borderColor:     online ? '#10B98130' : 'var(--border)',
                            }}
                          >
                            {online ? '● Online' : '○ Offline'}
                          </span>
                        </div>
                        <p className="text-[11px] truncate" style={{ color: 'var(--tx-3)' }}>
                          {session.staff_email}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    >
                      {cfg.label}
                    </div>

                    {/* Clock In */}
                    <div className="text-center flex-shrink-0 w-20">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Clock In</p>
                      <p className="text-[12px] font-mono font-semibold" style={{ color: 'var(--tx-1)' }}>
                        {formatTime(session.clock_in_time)}
                      </p>
                    </div>

                    {/* Clock Out */}
                    <div className="text-center flex-shrink-0 w-20">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Clock Out</p>
                      <p className="text-[12px] font-mono font-semibold" style={{ color: 'var(--tx-1)' }}>
                        {formatTime(session.clock_out_time)}
                      </p>
                    </div>

                    {/* Worked */}
                    <div className="text-center flex-shrink-0 w-24">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Worked</p>
                      <p className="text-[12px] font-mono font-bold" style={{ color: 'var(--tx-1)' }}>
                        {formatDuration(liveWorked)}
                      </p>
                    </div>

                    {/* Break */}
                    <div className="text-center flex-shrink-0 w-20">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Break</p>
                      <p className="text-[12px] font-mono" style={{ color: session.status === 'on_break' ? '#F59E0B' : 'var(--tx-2)' }}>
                        {formatDuration(liveBreak)}
                      </p>
                    </div>

                    {/* Overtime */}
                    <div className="text-center flex-shrink-0 w-28">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Overtime</p>
                      {hasOvertime ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <p className="text-[11px] font-mono font-semibold text-amber-400">
                            {formatDuration(session.overtime_seconds)}
                          </p>
                          {session.overtime_approved ? (
                            <span className="text-[9px] font-semibold text-emerald-400">Approved</span>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => void approveOvertime(session.id, true)}
                                disabled={approving === session.id}
                                className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => void approveOvertime(session.id, false)}
                                disabled={approving === session.id}
                                className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25 disabled:opacity-50 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] font-mono" style={{ color: 'var(--tx-3)' }}>—</p>
                      )}
                    </div>

                    {/* Earned Pay */}
                    <div className="text-right flex-shrink-0 w-28">
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Est. Pay</p>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                        {formatNaira(totalPay)}
                      </p>
                      {overtimePay > 0 && (
                        <p className="text-[9px] text-amber-400">
                          incl. {formatNaira(overtimePay)} OT
                        </p>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : session.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{ color: 'var(--tx-3)', backgroundColor: 'var(--bg-elevated)' }}
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {/* Expanded event log */}
                  {isExpanded && (
                    <div
                      className="px-5 pb-4 border-t"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-2" style={{ color: 'var(--tx-3)' }}>
                        Activity Log
                      </p>
                      {session.clock_events.length === 0 ? (
                        <p className="text-[12px]" style={{ color: 'var(--tx-3)' }}>No events recorded.</p>
                      ) : (
                        <div className="space-y-1">
                          {session.clock_events
                            .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
                            .map(ev => (
                              <div key={ev.id} className="flex items-center gap-3">
                                <span
                                  className="text-[10px] font-mono flex-shrink-0"
                                  style={{ color: 'var(--tx-3)' }}
                                >
                                  {new Date(ev.event_time).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ${eventBadge(ev.event_type)}`}
                                >
                                  {ev.event_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border"
      style={{
        color,
        borderColor:     `${color}30`,
        backgroundColor: `${color}12`,
      }}
    >
      {icon}
      <span>{value} {label}</span>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
    </div>
  )
}

function Empty({ date }: { date: string }) {
  return (
    <div className="text-center py-20">
      <Clock size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--tx-3)' }} />
      <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-2)' }}>
        No sessions on {date}
      </p>
      <p className="text-[12px] mt-1" style={{ color: 'var(--tx-3)' }}>
        Staff sessions will appear here once they clock in.
      </p>
    </div>
  )
}

function eventBadge(eventType: string): string {
  switch (eventType) {
    case 'clock_in':        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
    case 'clock_out':       return 'text-sky-400 bg-sky-500/10 border-sky-500/25'
    case 'break_start':     return 'text-amber-400 bg-amber-500/10 border-amber-500/25'
    case 'break_end':       return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25'
    case 'presence_pass':   return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
    case 'presence_timeout':
    case 'presence_fail':   return 'text-orange-400 bg-orange-500/10 border-orange-500/25'
    case 'auto_logout':     return 'text-rose-400 bg-rose-500/10 border-rose-500/25'
    case 'heartbeat_lost':  return 'text-rose-400 bg-rose-500/10 border-rose-500/25'
    default:                return 'text-slate-400 bg-slate-500/10 border-slate-500/25'
  }
}

// Satisfies TypeScript — statusLabel is used in formatters
void statusLabel
