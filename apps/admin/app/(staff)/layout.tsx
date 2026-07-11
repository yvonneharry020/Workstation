'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
      else setChecking(false)
    })
  }, [supabase, router])

  if (checking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-admin-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {children}
    </div>
  )
}
