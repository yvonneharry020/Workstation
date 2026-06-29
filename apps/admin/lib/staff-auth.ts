import { createAdminClient } from './supabase/admin'
import { createClient } from './supabase/server'

export interface StaffMember {
  email: string
  role: 'admin' | 'staff' | 'viewer'
  permissions: {
    admin: boolean
    management: boolean
    technical: boolean
    finance: boolean
  }
  is_active: boolean
  full_name: string | null
}

export type AllowedRoom = 'admin' | 'management' | 'technical' | 'finance'

// Server-side helper — uses service role to bypass RLS on staff_members
export async function getStaffMember(): Promise<{
  user: { id: string; email: string } | null
  staffMember: StaffMember | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { user: null, staffMember: null }

  const admin = createAdminClient()
  const { data } = await admin
    .from('staff_members')
    .select('email, role, permissions, is_active, full_name')
    .eq('email', user.email)
    .maybeSingle()

  return {
    user: { id: user.id, email: user.email },
    staffMember: data as StaffMember | null,
  }
}

export function getAllowedRooms(staffMember: StaffMember): AllowedRoom[] {
  if (staffMember.role === 'admin') {
    return ['admin', 'management', 'technical', 'finance']
  }
  const perms = staffMember.permissions ?? {}
  const rooms: AllowedRoom[] = []
  if (perms.admin)      rooms.push('admin')
  if (perms.management) rooms.push('management')
  if (perms.technical)  rooms.push('technical')
  if (perms.finance)    rooms.push('finance')
  return rooms
}

export function getPrimaryRoomRedirect(staffMember: StaffMember): string {
  if (staffMember.role === 'admin') return '/dashboard'
  const perms = staffMember.permissions ?? {}
  if (perms.admin)      return '/dashboard'
  if (perms.management) return '/ops/dashboard'
  if (perms.technical)  return '/tech/dashboard'
  if (perms.finance)    return '/finance/dashboard'
  return '/unauthorized'
}
