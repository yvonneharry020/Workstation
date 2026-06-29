import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SUPER_ADMIN_EMAIL = 'yvonne2okis@gmail.com'

export default async function TechRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (user.email !== SUPER_ADMIN_EMAIL) {
    const admin = createAdminClient()
    const { data: staffMember } = await admin
      .from('staff_members')
      .select('role, permissions, is_active')
      .eq('email', user.email!)
      .maybeSingle()

    const perms = (staffMember?.permissions as Record<string, boolean>) ?? {}
    const hasAccess =
      staffMember?.is_active &&
      (staffMember.role === 'admin' || perms.technical === true)

    if (!hasAccess) redirect('/unauthorized')
  }

  return <>{children}</>
}
