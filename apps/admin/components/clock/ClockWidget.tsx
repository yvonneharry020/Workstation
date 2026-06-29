'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import PresenceCheckModal from './PresenceCheckModal'
import { formatDuration } from '@/lib/clock-utils'

type SessionStatus = 'active' | 'on_break' | 'completed' | 'auto_logged_out'

interface ClockSession {
  id: string
  status: SessionStatus
  clock_in_time: string | null
  clock_out_time: string | null
  current_interval_started_at: string | null
  total_worked_seconds: number
  total_break_seconds: number
  overtime_seconds: number
  last_heartbeat_at: string | null
  next_presence_check_at: string | null
}

interface PresenceCheck {
  id: string
  attempt_number: number
  expires_at: string
}

interface HeartbeatResponse {
  session: ClockSession | null
  presenceCheck: PresenceCheck | null
  autoLogout?: boolean
}

const HEARTBEAT_INTERVAL_MS = 30_000

export default function ClockWidget() {
  const [session,       setSession]       = useState<ClockSession | null>(null)
  const [liveSeconds,   setLiveSeconds]   = useState(0)
  const [presenceCheck, setPresenceCheck] = useState<PresenceCheck | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Live timer tick ──────────────────────────────────────
  const startTick = useCallback((sess: ClockSession) => {
    if (tickRef.current) clearInterval(tickRef.current)

    function computeLive(s: ClockSession): number {
      const base = s.total_worked_seconds
      if (s.status !== 'active' || !s.current_interval_started_at) return base
      const elapsed = Math.max(0, Math.floor(
        (Date.now() - new Date(s.current_interval_started_at).getTime()) / 1000
      ))
      return base + elapsed
    }

    setLiveSeconds(computeLive(sess))

    if (sess.status === 'active') {
      tickRef.current = setInterval(() => {
        setLiveSeconds(computeLive(sess))
      }, 1000)
    }
  }, [])

  // ── Heartbeat ────────────────────────────────────────────
  const sendHeartbeat = useCallback(async () => {
    try {
      const res  = await fetch('/api/clock/heartbeat', { method: 'POST' })
      const json = await res.json() as HeartbeatResponse

      if (json.session) {
        setSession(json.session)
        startTick(json.session)
      }

      if (json.presenceCheck) {
        setPresenceCheck(json.presenceCheck)
      }

      if (json.autoLogout) {
        setPresenceCheck(null)
      }
    } catch {
      // Network error — silently continue; session stays as-is
    }
  }, [startTick])

  // ── Initial session load ─────────────────────────────────
  useEffect(() => {
    async function loadSession() {
      setLoading(true)
      try {
        const res  = await fetch('/api/clock/session')
        const json = await res.json() as { session: ClockSession | null }
        if (json.session) {
          setSession(json.session)
          startTick(json.session)
        }
      } catch {
        // Fail silently — not critical at load time
      } finally {
        setLoading(false)
      }
    }
    void loadSession()
  }, [startTick])

  // ── Heartbeat interval ───────────────────────────────────
  useEffect(() => {
    heartbeatRef.current = setInterval(() => { void sendHeartbeat() }, HEARTBEAT_INTERVAL_MS)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [sendHeartbeat])

  // ── Cleanup tick on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // ── Clock actions ────────────────────────────────────────
  async function doAction(action: 'clock_in' | 'pause' | 'resume' | 'clock_out') {
    if (actionLoading) return
    setActionLoading(action)
    try {
      const res  = await fetch('/api/clock/action', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      const json = await res.json() as { session?: ClockSession; error?: string }
      if (json.session) {
        setSession(json.session)
        startTick(json.session)
        // Reset presence check on any action
        setPresenceCheck(null)
      }
    } catch {
      // Silently handle — session unchanged
    } finally {
      setActionLoading(null)
    }
  }

  // ── Presence check response ──────────────────────────────
  async function handlePresenceResponse(checkId: string, response: 'pass' | 'timeout') {
    setPresenceCheck(null)
    try {
      await fetch('/api/clock/presence', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checkId, response }),
      })
    } catch {
      // Heartbeat will handle it on next cycle
    }
  }

  // ── Render ───────────────────────────────────────────────
  if (loading) return null

  const status  = session?.status
  const isIdle  = !session || status === 'auto_logged_out'
  const isActive   = status === 'active'
  const isOnBreak  = status === 'on_break'
  const isDone     = status === 'completed'

  const statusDot = isActive   ? '#10B981'
    : isOnBreak               ? '#F59E0B'
    : isDone                  ? 'var(--tx-3)'
    : 'var(--tx-3)'

  const statusText = isActive   ? 'Online'
    : isOnBreak               ? 'On Break'
    : isDone                  ? 'Offline'
    : status === 'auto_logged_out' ? 'Auto Logged Out'
    : 'Offline'

  return (
    <>
      {presenceCheck && (
        <PresenceCheckModal
          check={presenceCheck}
          onRespond={handlePresenceResponse}
        />
      )}

      <div
        className="mx-3 mb-2 rounded-xl p-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border:          '1px solid var(--border)',
        }}
      >
        {/* Status + timer row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: statusDot,
                boxShadow:       isActive ? `0 0 5px ${statusDot}` : 'none',
              }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--tx-3)' }}>
              {statusText}
            </span>
          </div>

          {/* Live timer */}
          <span
            className="text-[13px] font-bold font-mono tracking-tight"
            style={{ color: isDone || isIdle ? 'var(--tx-3)' : 'var(--tx-1)' }}
          >
            {formatDuration(liveSeconds)}
          </span>
        </div>

        {/* Break time row — only when session has break */}
        {session && session.total_break_seconds > 0 && (
          <div className="flex justify-between mb-2.5">
            <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>Break taken</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--tx-3)' }}>
              {formatDuration(session.total_break_seconds)}
            </span>
          </div>
        )}

        {/* Control buttons */}
        {!isDone && (
          <div className="flex gap-1.5">
            {/* Play — clock in or resume from break */}
            {(isIdle || isOnBreak) && (
              <button
                onClick={() => void doAction(isOnBreak ? 'resume' : 'clock_in')}
                disabled={!!actionLoading}
                title={isOnBreak ? 'Resume work' : 'Clock in'}
                className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#10B98120', color: '#10B981', border: '1px solid #10B98130' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#10B98130' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#10B98120' }}
              >
                {actionLoading === (isOnBreak ? 'resume' : 'clock_in')
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Play size={11} fill="currentColor" />
                }
                {isOnBreak ? 'Resume' : 'Clock In'}
              </button>
            )}

            {/* Pause — start break */}
            {isActive && (
              <button
                onClick={() => void doAction('pause')}
                disabled={!!actionLoading}
                title="Take a break"
                className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#F59E0B20', color: '#F59E0B', border: '1px solid #F59E0B30' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F59E0B30' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F59E0B20' }}
              >
                {actionLoading === 'pause'
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Pause size={11} fill="currentColor" />
                }
                Break
              </button>
            )}

            {/* Stop — clock out */}
            {(isActive || isOnBreak) && (
              <button
                onClick={() => void doAction('clock_out')}
                disabled={!!actionLoading}
                title="Clock out for the day"
                className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#EF444420', color: '#EF4444', border: '1px solid #EF444430' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EF444430' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EF444420' }}
              >
                {actionLoading === 'clock_out'
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <Square size={11} fill="currentColor" />
                }
                Stop
              </button>
            )}
          </div>
        )}

        {isDone && (
          <p className="text-center text-[10px]" style={{ color: 'var(--tx-3)' }}>
            Session complete for today
          </p>
        )}
      </div>
    </>
  )
}
