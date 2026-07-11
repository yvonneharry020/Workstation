'use client'

import { useTransition } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import { useRouter } from 'next/navigation'

export default function AccessRestrictedPage() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  function handleSignOut() {
    startTransition(async () => {
      await supabase.auth.signOut()
      router.push('/login')
    })
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-error">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold font-display text-text-primary mb-2">
          Access Deactivated
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          Your access to this platform has been deactivated by an administrator.
          Contact your administrator for further assistance.
        </p>
        <div className="bg-surface-card border border-surface-border rounded-xl px-5 py-4 mb-6">
          <p className="text-xs text-text-muted">If you believe this is an error, reach out to your administrator and provide your email address.</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="w-full py-2.5 rounded-lg bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
