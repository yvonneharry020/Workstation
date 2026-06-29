import Sidebar from '@/components/layout/Sidebar'
import DeptSwitcher from '@/components/layout/DeptSwitcher'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SUPER_ADMIN_EMAIL = 'yvonne2okis@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

    if (staffMember?.is_active) {
      const perms = (staffMember.permissions as Record<string, boolean>) ?? {}
      const hasAdminAccess = staffMember.role === 'admin' || perms.admin === true

      if (!hasAdminAccess) {
        // Redirect to their primary room
        if (perms.management) redirect('/ops/dashboard')
        if (perms.technical)  redirect('/tech/dashboard')
        if (perms.finance)    redirect('/finance/dashboard')
        redirect('/unauthorized')
      }
    } else if (!staffMember) {
      // No staff record and not super admin — block access
      redirect('/login')
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <DeptSwitcher />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
