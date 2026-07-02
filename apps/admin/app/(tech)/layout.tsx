import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function TechRootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const role     = cookieStore.get('_wk_role')?.value
  const permsRaw = cookieStore.get('_wk_perms')?.value

  if (!role) redirect('/login')

  if (role !== 'superadmin' && role !== 'admin') {
    const perms = permsRaw
      ? (JSON.parse(permsRaw) as { technical?: boolean })
      : {}
    if (!perms.technical) redirect('/unauthorized')
  }

  return <>{children}</>
}
