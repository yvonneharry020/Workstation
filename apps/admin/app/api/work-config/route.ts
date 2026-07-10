import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // This returns every staff member's salary — admin only, matching POST below.
  const { data: staffMember } = await admin
    .from('staff_members')
    .select('role')
    .eq('email', user.email)
    .maybeSingle()

  const isSuperAdmin = user.email === 'yvonne2okis@gmail.com'
  const isAdmin      = isSuperAdmin || staffMember?.role === 'admin'

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { data: configs, error } = await admin
    .from('staff_work_config')
    .select('*')
    .order('staff_email', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also fetch all staff members so the page can show unconfigured ones
  const { data: allStaff } = await admin
    .from('staff_members')
    .select('id, email, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  return NextResponse.json({ configs: configs ?? [], staff: allStaff ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Only admins can configure work settings
  const { data: staffMember } = await admin
    .from('staff_members')
    .select('role')
    .eq('email', user.email)
    .maybeSingle()

  const isSuperAdmin = user.email === 'yvonne2okis@gmail.com'
  const isAdmin      = isSuperAdmin || staffMember?.role === 'admin'

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await req.json() as {
    staff_member_id: string
    staff_email: string
    monthly_salary_naira: number
    work_days: number[]
    work_start_time: string
    work_end_time: string
    break_duration_minutes: number
    presence_check_interval_minutes?: number
  }

  const payload = {
    staff_member_id:                 body.staff_member_id,
    staff_email:                     body.staff_email,
    monthly_salary_naira:            body.monthly_salary_naira,
    work_days:                       body.work_days,
    work_start_time:                 body.work_start_time,
    work_end_time:                   body.work_end_time,
    break_duration_minutes:          body.break_duration_minutes,
    presence_check_interval_minutes: body.presence_check_interval_minutes ?? 120,
    updated_by:                      user.email,
  }

  const { data, error } = await admin
    .from('staff_work_config')
    .upsert(payload, { onConflict: 'staff_member_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
}
