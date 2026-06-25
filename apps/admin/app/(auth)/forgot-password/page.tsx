'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction, type ForgotState } from '@/lib/auth-actions'

export default function ForgotPasswordPage() {
  const [state, setState] = useState<ForgotState>({})
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await forgotPasswordAction(state, formData)
      setState(result)
    })
  }

  return (
    <div>
      {/* Back */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mb-8"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to sign in
      </Link>

      {/* Card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="mb-6">
          <div className="w-10 h-10 rounded-xl bg-admin-900/60 border border-admin-700/40 flex items-center justify-center mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          </div>
          <h1 className="text-xl font-bold font-display text-text-primary">Reset your password</h1>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
            Enter the email address linked to your admin account. If it exists, you&apos;ll receive a secure reset link within a few minutes.
          </p>
        </div>

        {/* Success state */}
        {state.success ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 bg-teal-500/10 border border-teal-500/25 rounded-lg px-4 py-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-teal-300">Check your email</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  If that address is registered, a reset link has been sent. It expires in <span className="font-semibold text-text-primary">60 minutes</span> and can only be used once.
                </p>
              </div>
            </div>
            <p className="text-xs text-text-muted text-center">
              Didn&apos;t get it? Check your spam folder or{' '}
              <button
                onClick={() => setState({})}
                className="text-admin-400 hover:text-admin-300 underline underline-offset-2 transition-colors"
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
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

            <div className="mb-5">
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
                  Sending link…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-text-muted mt-6">
        For account access issues, contact your system administrator.
      </p>
    </div>
  )
}
