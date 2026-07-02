'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logoutSingleAction } from '@/lib/auth-actions'
import { removeAccountToken } from '@/lib/supabase/tab-client'

type LogoutButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'> & {
  showLabel?: boolean
}

export default function LogoutButton({ showLabel = true, children, ...rest }: LogoutButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      // Read which account this tab belongs to
      let email: string | null = null
      try {
        const stored = sessionStorage.getItem('_wk_session')
        if (stored) email = (JSON.parse(stored) as { email?: string }).email ?? null
      } catch { /* fall through */ }

      // Always clear this tab's local state first
      sessionStorage.removeItem('_wk_session')

      if (email) {
        // Remove this account's localStorage token slot
        removeAccountToken(email)

        // Remove from multi-session cookie. If it was the last session,
        // the server action also signs out the shared Supabase cookie.
        const { wasLast } = await logoutSingleAction(email)

        if (!wasLast) {
          // Other accounts still logged in — only this tab goes to login.
          // We do NOT call supabase.auth.signOut() because that would
          // invalidate the shared Supabase cookie other tabs depend on.
          router.replace('/login')
          return
        }
      } else {
        // No tab session — fall back to signing out the shared Supabase session
        const supabase = createClient()
        await supabase.auth.signOut()
      }

      router.replace('/login')
    })
  }

  return (
    <button
      {...rest}
      onClick={handleLogout}
      disabled={isPending}
      title={rest.title ?? 'Sign out'}
    >
      <LogOut size={14} className={isPending ? 'opacity-50' : ''} />
      {showLabel && <span>{isPending ? 'Signing out…' : 'Sign out'}</span>}
      {children}
    </button>
  )
}
