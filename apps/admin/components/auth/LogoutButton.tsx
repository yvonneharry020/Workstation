'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type LogoutButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'> & {
  showLabel?: boolean
}

export default function LogoutButton({ showLabel = true, children, ...rest }: LogoutButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      sessionStorage.removeItem('_wk_session')
      const supabase = createClient()
      await supabase.auth.signOut()
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
