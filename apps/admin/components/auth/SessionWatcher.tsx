'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SessionWatcher() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Read what user THIS TAB expects to be logged in as (written at login time)
    function getExpectedEmail(): string | null {
      try {
        const stored = sessionStorage.getItem('_wk_session')
        if (!stored) return null
        return (JSON.parse(stored) as { email: string }).email ?? null
      } catch {
        return null
      }
    }

    async function checkSession() {
      const expectedEmail = getExpectedEmail()
      if (!expectedEmail) return // no session expectation stored — skip check

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Session expired entirely
        sessionStorage.removeItem('_wk_session')
        router.replace('/login')
        return
      }

      if (user.email !== expectedEmail) {
        // Another account took over the shared auth cookie for this tab.
        // Force this tab back to login so the correct user re-authenticates.
        sessionStorage.removeItem('_wk_session')
        router.replace('/login?error=session_changed')
      }
    }

    // Check immediately on mount
    void checkSession()

    // Re-check whenever this tab becomes visible after the user switches back to it.
    // This is the key moment: user is on Finance tab, switches to Admin tab (Admin logs in),
    // then switches back to Finance tab — we catch it here.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also listen for Supabase auth state changes (fires within same tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('_wk_session')
        router.replace('/login')
        return
      }
      const expectedEmail = getExpectedEmail()
      if (expectedEmail && session?.user?.email && session.user.email !== expectedEmail) {
        sessionStorage.removeItem('_wk_session')
        router.replace('/login?error=session_changed')
      }
    })

    // Existing: listen for admin-broadcast force_logout / permissions_updated events
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      supabase
        .channel(`staff-session:${user.email}`)
        .on('broadcast', { event: 'force_logout' }, async (msg) => {
          const reason = (msg.payload as Record<string, string>)?.reason ?? 'session_expired'
          sessionStorage.removeItem('_wk_session')
          await supabase.auth.signOut()
          router.replace(`/login?error=${reason}`)
        })
        .on('broadcast', { event: 'permissions_updated' }, () => {
          router.refresh()
        })
        .subscribe()
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
