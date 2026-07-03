'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { createTabClient } from '@/lib/supabase/tab-client'
import { logDbAccess } from '@/lib/db-access-actions'

const SESSION_DURATION_MS = 60 * 60 * 1000  // 60 minutes hard limit
const WARN_BEFORE_MS      = 5 * 60 * 1000   // warn 5 min before expiry

interface Props {
  room: string
  children: ReactNode
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function getTabSessionEmail(): string | null {
  try {
    const s = sessionStorage.getItem('_wk_session')
    return s ? (JSON.parse(s) as { email?: string }).email ?? null : null
  } catch {
    return null
  }
}

function getTabId(): string {
  let id = sessionStorage.getItem('_wk_tab_id')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('_wk_tab_id', id)
  }
  return id
}

function storageKey(room: string) {
  return `db_access_${room}`
}

function parseStoredSession(room: string): { email: string; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(storageKey(room))
    if (!raw) return null
    const idx = raw.lastIndexOf(':')
    const email = raw.slice(0, idx)
    const ts = Number(raw.slice(idx + 1))
    if (!email || isNaN(ts)) return null
    return { email, ts }
  } catch {
    return null
  }
}

async function logDbEvent(supabase: ReturnType<typeof createTabClient>, email: string, room: string, event: string, metadata: Record<string, unknown>) {
  try {
    await supabase.from('audit_logs').insert({
      event,
      actor_email: email,
      actor_type: 'admin',
      severity: 'info',
      app: 'admin_panel',
      metadata: { room, ...metadata },
    })
  } catch { /* non-critical */ }
}

export default function DatabaseGate({ room, children }: Props) {
  const [authenticated, setAuthenticated] = useState(false)
  const [sessionStart, setSessionStart]   = useState<number | null>(null)
  const [timeLeftMs, setTimeLeftMs]       = useState<number | null>(null)
  const [passcode, setPasscode]           = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [expiredMsg, setExpiredMsg]       = useState<string | null>(null)
  const [mounted, setMounted]             = useState(false)

  const handleExpiry = useCallback(async () => {
    const session = parseStoredSession(room)
    sessionStorage.removeItem(storageKey(room))
    setAuthenticated(false)
    setSessionStart(null)
    setTimeLeftMs(null)
    setExpiredMsg('Database session expired (60-minute limit). Re-enter your passcode to continue.')

    if (session?.email) {
      const supabase = createTabClient()
      await logDbEvent(supabase, session.email, room, 'database.session_expired', {
        reason: 'timeout_60min',
        expired_at: new Date().toISOString(),
      })
    }
  }, [room])

  // On mount: validate stored session or detect immediate expiry
  useEffect(() => {
    const session = parseStoredSession(room)
    if (session) {
      const elapsed = Date.now() - session.ts
      if (elapsed >= SESSION_DURATION_MS) {
        sessionStorage.removeItem(storageKey(room))
        setExpiredMsg('Database session expired (60-minute limit). Re-enter your passcode to continue.')
      } else {
        setAuthenticated(true)
        setSessionStart(session.ts)
      }
    }
    setMounted(true)
  }, [room])

  // Countdown + auto-expiry timers
  useEffect(() => {
    if (!authenticated || !sessionStart) return

    const tick = () => {
      const left = SESSION_DURATION_MS - (Date.now() - sessionStart)
      if (left <= 0) {
        void handleExpiry()
        return
      }
      setTimeLeftMs(left)
    }

    tick()
    const interval = setInterval(tick, 10_000) // refresh every 10 s
    const expireTimeout = setTimeout(() => void handleExpiry(), SESSION_DURATION_MS - (Date.now() - sessionStart))

    return () => {
      clearInterval(interval)
      clearTimeout(expireTimeout)
    }
  }, [authenticated, sessionStart, handleExpiry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passcode.trim()) return
    setLoading(true)
    setError(null)

    try {
      const staffEmail = getTabSessionEmail()
      if (!staffEmail) {
        setError('Session not found. Please log out and log back in.')
        setLoading(false)
        return
      }

      const hash = await sha256(passcode.trim())
      const supabase = createTabClient()

      const { data, error: dbErr } = await supabase
        .from('db_passcodes')
        .select('email')
        .eq('email', staffEmail)
        .eq('passcode_hash', hash)
        .maybeSingle()

      if (dbErr) throw dbErr

      if (!data) {
        const { data: anyMatch } = await supabase
          .from('db_passcodes')
          .select('email')
          .eq('passcode_hash', hash)
          .maybeSingle()

        if (anyMatch && anyMatch.email !== staffEmail) {
          setError('Access denied — this passcode belongs to a different account.')
        } else {
          setError('Incorrect passcode. Please try again.')
        }
        setLoading(false)
        return
      }

      const tabId = getTabId()
      const { data: authData } = await supabase.auth.getUser()
      const staffId = authData?.user?.id ?? null

      await logDbAccess({ staffEmail, staffId, room, sessionId: tabId })

      await supabase
        .from('db_passcodes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('email', staffEmail)

      const now = Date.now()
      sessionStorage.setItem(storageKey(room), `${staffEmail}:${now}`)
      setSessionStart(now)
      setExpiredMsg(null)
      setAuthenticated(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  if (authenticated) {
    const showWarning = timeLeftMs !== null && timeLeftMs <= WARN_BEFORE_MS
    const minsLeft = timeLeftMs !== null ? Math.ceil(timeLeftMs / 60_000) : null

    return (
      <>
        {showWarning && minsLeft !== null && (
          <div style={{
            position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1000,
            backgroundColor: '#7C3AED', color: '#fff',
            padding: '10px 24px', textAlign: 'center', fontSize: 13, fontWeight: 600,
          }}>
            Database session expires in {minsLeft} minute{minsLeft !== 1 ? 's' : ''} — save your work.
          </div>
        )}
        {children}
      </>
    )
  }

  const CARD = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-card)',
    width: '100%',
    maxWidth: '420px',
    padding: '44px',
  }

  return (
    <div
      style={{ backgroundColor: 'var(--bg-base)', minHeight: 'calc(100vh - 61px)' }}
      className="flex items-center justify-center"
    >
      <div style={CARD}>
        <div className="flex justify-center mb-6">
          <div style={{
            width: '56px', height: '56px',
            backgroundColor: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <h2 className="text-center text-[18px] font-bold font-display mb-1.5" style={{ color: 'var(--tx-1)' }}>
          Database Access
        </h2>
        <p className="text-center text-[13px] mb-6" style={{ color: 'var(--tx-3)' }}>
          Enter your personal security passcode to unlock this room.
          <br />Sessions are limited to 60 minutes and fully logged.
        </p>

        {expiredMsg && (
          <div style={{
            backgroundColor: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: '#F59E0B', textAlign: 'center',
          }}>
            {expiredMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
            style={{
              width: '100%', padding: '11px 14px',
              borderRadius: '10px',
              border: `1px solid ${error ? '#F87171' : 'var(--border)'}`,
              backgroundColor: 'var(--bg-base)',
              color: 'var(--tx-1)', fontSize: '16px',
              outline: 'none', letterSpacing: '0.2em',
              textAlign: 'center' as const,
            }}
          />

          {error && (
            <p style={{ color: '#F87171', fontSize: '12px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            style={{
              width: '100%', padding: '11px',
              borderRadius: '10px',
              backgroundColor: loading || !passcode.trim() ? 'rgba(99,102,241,0.4)' : '#6366F1',
              color: 'white', fontSize: '14px', fontWeight: 600,
              border: 'none', cursor: loading || !passcode.trim() ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Verifying…' : 'Unlock Database'}
          </button>
        </form>

        <p className="text-center text-[11px] mt-5" style={{ color: 'var(--tx-3)' }}>
          This passcode is personal and non-transferable. Each access is permanently recorded.
        </p>
      </div>
    </div>
  )
}
