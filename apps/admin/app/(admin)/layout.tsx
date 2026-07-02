import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import DeptSwitcher from '@/components/layout/DeptSwitcher'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const role = cookieStore.get('_wk_role')?.value

  if (!role) redirect('/login')
  if (role !== 'superadmin' && role !== 'admin') redirect('/unauthorized')

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
