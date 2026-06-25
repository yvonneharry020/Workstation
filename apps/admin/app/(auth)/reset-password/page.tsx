'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { resetPasswordAction, type ResetState } from '@/lib/auth-actions'
import { validatePassword } from '@/lib/password-validator'

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { score, errors } = validatePassword(password)
  const pct = Math.round((score / 10) * 100)
  const color =
    score <= 3 ? '#EF4444' : score <= 6 ? '#F59E0B' : score <= 8 ? '#0DD4C3' : '#22C55E'
  const label =
    score <= 3 ? 'Weak' : score <= 6 ? 'Fair' : score <= 8 ? 'Good' : 'Strong'

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden mr-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-[10px] font-semibold font-mono" style={{ color }}>
          {label}
        </span>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map((err) => (
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

export default function ResetPasswordPage() {
  const [state, setState] = useState<ResetState>({})
  const [isPending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await resetPasswordAction(state, formData)
      setState(result)
    })
  }

  if (state.success) {
    return (
      <div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display text-text-primary mb-2">Password updated</h2>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Your password has been changed successfully. All other active sessions have been signed out for your security.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-3 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors"
          >
            Sign in with new password
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40">
        <div className="mb-6">
          <div className="w-10 h-10 rounded-xl bg-admin-900/60 border border-admin-700/40 flex items-center justify-center mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold font-display text-text-primary">Set new password</h1>
          <p className="text-sm text-text-secondary mt-1">
            Choose a strong password for your admin account.
          </p>
        </div>

        {/* Error banner */}
        {state.error && (
          <div className="flex items-start gap-3 bg-error/10 border border-error/25 rounded-lg px-4 py-3 mb-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-error leading-snug">{state.error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* New password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              New password
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                className={`w-full bg-surface-elevated border rounded-lg px-4 py-3 pr-11 text-sm text-text-primary placeholder-text-muted focus:outline-none transition-colors ${
                  state.fieldErrors?.password
                    ? 'border-error focus:border-error'
                    : 'border-surface-border focus:border-admin-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-0.5"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
            <StrengthMeter password={password} />
            {state.fieldErrors?.password && (
              <ul className="mt-1.5 space-y-0.5">
                {state.fieldErrors.password.map((e) => (
                  <li key={e} className="text-xs text-error">{e}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Confirm password */}
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={128}
                placeholder="Re-enter your password"
                className={`w-full bg-surface-elevated border rounded-lg px-4 py-3 pr-11 text-sm text-text-primary placeholder-text-muted focus:outline-none transition-colors ${
                  state.fieldErrors?.confirmPassword
                    ? 'border-error focus:border-error'
                    : 'border-surface-border focus:border-admin-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-0.5"
                aria-label={showConfirm ? 'Hide' : 'Show'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {state.fieldErrors?.confirmPassword && (
              <p className="text-xs text-error mt-1.5">{state.fieldErrors.confirmPassword[0]}</p>
            )}
          </div>

          {/* Requirements reminder */}
          <div className="bg-surface-muted rounded-lg px-4 py-3 mb-5">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Password must be <span className="text-text-secondary font-semibold">12+ characters</span> and include uppercase, lowercase, a number, and a special character.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-lg bg-admin-500 hover:bg-admin-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Updating password…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-text-muted mt-6">
        Remember your password?{' '}
        <Link href="/login" className="text-admin-400 hover:text-admin-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
