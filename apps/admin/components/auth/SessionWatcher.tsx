'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SessionWatcher() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channelName: string | null = null

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      channelName = `staff-session:${user.email}`

      const channel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'force_logout' }, async (msg) => {
          const reason = (msg.payload as Record<string, string>)?.reason ?? 'session_expired'
          await supabase.auth.signOut()
          router.replace(`/login?error=${reason}`)
        })
        .on('broadcast', { event: 'permissions_updated' }, () => {
          router.refresh()
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [router])

  return null
}
