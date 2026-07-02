'use client'

import { useEffect } from 'react'
import { createTabClient } from '@/lib/supabase/tab-client'

export default function SessionWatcher() {
  useEffect(() => {
    // Each tab uses its own account's token via createTabClient(), so there
    // is no longer any need to detect or fight the shared Supabase cookie.
    // This watcher only handles admin-broadcast events (force logout, permission changes).
    const supabase = createTabClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      supabase
        .channel(`staff-session:${user.email}`)
        .on('broadcast', { event: 'force_logout' }, async (msg) => {
          const reason = (msg.payload as Record<string, string>)?.reason ?? 'session_expired'
          sessionStorage.removeItem('_wk_session')
          await supabase.auth.signOut()
          window.location.replace(`/login?error=${reason}`)
        })
        .on('broadcast', { event: 'permissions_updated' }, () => {
          window.location.reload()
        })
        .subscribe()
    })
  }, [])

  return null
}
