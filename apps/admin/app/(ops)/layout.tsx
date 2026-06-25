import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SUPER_ADMIN_EMAIL = 'yvonne2okis@gmail.com'

export default async function OpsRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (user.email !== SUPER_ADMIN_EMAIL) {
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('department, is_active')
      .eq('email', user.email!)
      .maybeSingle()

    if (!staffMember?.is_active || staffMember.department !== 'management') {
      redirect('/dashboard')
    }
  }

  return <>{children}</>
}
