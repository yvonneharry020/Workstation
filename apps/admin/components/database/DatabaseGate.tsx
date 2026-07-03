'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createTabClient } from '@/lib/supabase/tab-client'

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

export default function DatabaseGate({ room, children }: Props) {
  const [authenticated, setAuthenticated] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem(storageKey(room))
    if (token) setAuthenticated(true)
    setMounted(true)
  }, [room])

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

      await supabase.from('db_access_log').insert({
        staff_email: staffEmail,
        staff_id: staffId,
        room,
        session_id: tabId,
      })

      await supabase
        .from('db_passcodes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('email', staffEmail)

      sessionStorage.setItem(storageKey(room), `${staffEmail}:${Date.now()}`)
      setAuthenticated(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null
  if (authenticated) return <>{children}</>

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
          <br />Access is session-bound and fully logged.
        </p>

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
