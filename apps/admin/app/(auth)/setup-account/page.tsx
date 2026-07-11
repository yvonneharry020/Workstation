'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import { validatePassword } from '@/lib/password-validator'

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { score, errors } = validatePassword(password)
  const pct = Math.round((score / 10) * 100)
  const color =
    score <= 3 ? '#EF4444' : score <= 6 ? '#F59E0B' : score <= 8 ? '#0DD4C3' : '#22C55E'
  const label = score <= 3 ? 'Weak' : score <= 6 ? 'Fair' : score <= 8 ? 'Good' : 'Strong'
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden mr-3">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-[10px] font-semibold font-mono" style={{ color }}>{label}</span>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map(err => (
            <li key={err} className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="3" stroke="#64748B" strokeWidth="1.5" />
              </svg>
              {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function SetupAccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()

    // The invite link contains the session tokens in the URL hash (implicit flow).
    // Parse and set the session before checking getUser().
    const hash = window.location.hash.slice(1)
    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const tokenType = hashParams.get('type')

    if (accessToken && refreshToken && tokenType === 'invite') {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { user }, error }) => {
          if (error || !user) {
            router.replace('/login?error=invite_expired')
          } else {
            setEmail(user.email ?? '')
            // Clean the hash from the URL without a page reload
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }
        })
      return
    }

    // No hash — check if already has a valid session (e.g. page refresh)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?error=invite_expired')
      } else {
        setEmail(user.email ?? '')
      }
    })
  }, [router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    const validation = validatePassword(password)
    if (!validation.valid) {
      setError(validation.errors[0])
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setSuccess(true)
    })
  }

  async function goToLogin() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  if (success) {
    return (
      <div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display text-text-primary mb-2">Account created</h2>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Your password has been set. Click below to go to the login page and sign in with your email and new password.
          </p>
          <button
            onClick={goToLogin}
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors"
          >
            Go to Login
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-admin-900 border border-admin-700/50 flex items-center justify-center mb-4 shadow-lg shadow-admin-500/20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight">Create your account</h1>
        <p className="text-sm text-text-muted mt-1">Set a password to complete your setup</p>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40">
        <h2 className="text-lg font-semibold font-display text-text-primary mb-6">Set your password</h2>

        {error && (
          <div className="flex items-start gap-3 bg-error/10 border border-error/25 rounded-lg px-4 py-3 mb-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-error leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Email address
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full bg-surface-elevated/50 border border-surface-border rounded-lg px-4 py-3 text-sm text-text-muted cursor-not-allowed select-none"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={128}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-3 pr-11 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-admin-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-0.5" aria-label={showPw ? 'Hide' : 'Show'}>
                <EyeIcon open={showPw} />
              </button>
            </div>
            <StrengthMeter password={password} />
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={128}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-3 pr-11 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-admin-500 transition-colors"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-0.5" aria-label={showConfirm ? 'Hide' : 'Show'}>
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          <div className="bg-surface-muted rounded-lg px-4 py-3 mb-5">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Password must be <span className="text-text-secondary font-semibold">12+ characters</span> and include uppercase, lowercase, a number, and a special character.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending || !password || !confirmPassword}
            className="w-full py-3 rounded-lg bg-admin-500 hover:bg-admin-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Creating account…
              </>
            ) : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-text-muted mt-6">
        Already set up?{' '}
        <button onClick={goToLogin} className="text-admin-400 hover:text-admin-300 transition-colors">
          Go to Login
        </button>
      </p>
    </div>
  )
}
