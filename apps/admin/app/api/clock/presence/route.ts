import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextPresenceCheckAt } from '@/lib/clock-utils'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { checkId: string; response: 'pass' | 'timeout' }
  const { checkId, response } = body

  if (!checkId || !['pass', 'timeout'].includes(response)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now   = new Date()

  const { data: check } = await admin
    .from('presence_checks')
    .select('*')
    .eq('id', checkId)
    .eq('staff_email', user.email)
    .eq('status', 'pending')
    .maybeSingle()

  if (!check) {
    return NextResponse.json({ error: 'Check not found or already resolved' }, { status: 404 })
  }

  if (response === 'pass') {
    await admin
      .from('presence_checks')
      .update({ status: 'passed', responded_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', checkId)

    await admin.from('clock_events').insert({
      session_id:      check.session_id,
      staff_member_id: check.staff_member_id,
      staff_email:     user.email,
      event_type:      'presence_pass',
      event_time:      now.toISOString(),
      metadata:        { attempt: check.attempt_number },
    })

    // Schedule next check
    const intervalMins = 120
    await admin
      .from('clock_sessions')
      .update({ next_presence_check_at: nextPresenceCheckAt(now, intervalMins).toISOString() })
      .eq('id', check.session_id)

    return NextResponse.json({ success: true, autoLogout: false })
  }

  // response === 'timeout' — the client's 60s timer expired before we handled it here.
  // The heartbeat endpoint processes timeouts independently, but the client sends this
  // as a safety signal. Just acknowledge it; heartbeat will handle the logic.
  return NextResponse.json({ success: true, autoLogout: false })
}
