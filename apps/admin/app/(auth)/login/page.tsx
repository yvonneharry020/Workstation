'use client'

import { useTransition, useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginAction, type LoginState } from '@/lib/auth-actions'

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 3L5 7.5V15C5 21.08 9.84 26.74 16 28C22.16 26.74 27 21.08 27 15V7.5L16 3Z"
        fill="url(#shieldGrad)"
        stroke="#A855F7"
        strokeWidth="1.5"
      />
      <polyline
        points="10,16 14,20 22,12"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shieldGrad" x1="5" y1="3" x2="27" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#A855F7" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
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

const CALLBACK_ERRORS: Record<string, string> = {
  auth_failed: 'Authentication failed. Please sign in again.',
  auth_callback_failed: 'Something went wrong during authentication. Please try again.',
  missing_code: 'Invalid authentication link.',
  link_expired: 'Your invite link has expired or was already used. Contact your administrator to send a new one.',
  deactivated: 'Your access has been deactivated. Contact your administrator for help.',
  viewer: 'Your access level has been updated. Please sign in again to continue.',
  permissions_changed: 'Your room access has been updated. Please sign in again.',
  session_changed: 'Another account signed in on this device. Please sign in again to continue.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')
  const [state, setState] = useState<LoginState>({})
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAction(state, formData)
      if (result?.redirectTo) {
        if (result.tabSession) {
          sessionStorage.setItem('_wk_session', JSON.stringify(result.tabSession))
        }
        router.replace(result.redirectTo)
      } else {
        setState(result)
      }
    })
  }

  const errorMsg = callbackError
    ? (CALLBACK_ERRORS[callbackError] ?? 'An error occurred. Please sign in.')
    : state.error

  return (
    <div>
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-admin-900 border border-admin-700/50 flex items-center justify-center mb-4 shadow-lg shadow-admin-500/20">
          <ShieldIcon />
        </div>
        <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight">
          Workstation Admin
        </h1>
        <p className="text-sm text-text-muted mt-1">Secure administrator access only</p>
      </div>

      {/* Card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40">
        <h2 className="text-lg font-semibold font-display text-text-primary mb-6">Sign in</h2>

        {/* Error banner */}
        {errorMsg && (
          <div className="flex items-start gap-3 bg-error/10 border border-error/25 rounded-lg px-4 py-3 mb-5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-error leading-snug">{errorMsg}</p>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} noValidate autoComplete="on">
          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="admin@workstation.ng"
              className={`w-full bg-surface-elevated border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none transition-colors ${
                state.fieldErrors?.email
                  ? 'border-error focus:border-error'
                  : 'border-surface-border focus:border-admin-500'
              }`}
            />
            {state.fieldErrors?.email && (
              <p className="text-xs text-error mt-1.5">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-admin-400 hover:text-admin-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="Enter your password"
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
            {state.fieldErrors?.password && (
              <p className="text-xs text-error mt-1.5">{state.fieldErrors.password[0]}</p>
            )}
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
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 mt-6 text-text-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-xs">Session encrypted · Access logged · Brute-force protected</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
