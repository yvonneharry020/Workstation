import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admin/superadmin can approve overtime
  const admin = createAdminClient()
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

  const { sessionId } = await params
  const body = await req.json() as { approved: boolean }
  const now  = new Date()

  const updatePayload = body.approved
    ? {
        overtime_approved:    true,
        overtime_approved_by: user.email,
        overtime_approved_at: now.toISOString(),
      }
    : {
        overtime_approved:    false,
        overtime_approved_by: null,
        overtime_approved_at: null,
      }

  const { data, error } = await admin
    .from('clock_sessions')
    .update(updatePayload)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ session: data })
}
