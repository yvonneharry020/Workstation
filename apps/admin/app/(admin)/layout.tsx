import Sidebar from '@/components/layout/Sidebar'
import DeptSwitcher from '@/components/layout/DeptSwitcher'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SUPER_ADMIN_EMAIL = 'yvonne2okis@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Staff members get routed to their department room
  if (user.email !== SUPER_ADMIN_EMAIL) {
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('department, is_active')
      .eq('email', user.email!)
      .maybeSingle()

    if (staffMember?.is_active) {
      // Check if staff has completed onboarding profile
      const { data: profile } = await supabase
        .from('staff_profiles')
        .select('profile_complete')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.profile_complete) {
        redirect('/staff-profile')
      }

      if (staffMember.department === 'technical') redirect('/tech/dashboard')
      if (staffMember.department === 'accounting') redirect('/finance/dashboard')
      if (staffMember.department === 'management') redirect('/ops/dashboard')
    }
  }

  const { count: adminInboxCount } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('department', 'Admin')
    .not('status', 'in', '("resolved","closed")')

  return (
    <div className="flex min-h-screen">
      <Sidebar pendingCandidates={23} pendingCompanies={8} flaggedItems={14} badgeDisputes={2} adminInboxCount={adminInboxCount ?? 0} />
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <DeptSwitcher />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
