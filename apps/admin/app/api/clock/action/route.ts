import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeHourlyRate,
  computeStandardWorkSeconds,
  nextPresenceCheckAt,
} from '@/lib/clock-utils'

type ClockAction = 'clock_in' | 'pause' | 'resume' | 'clock_out'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { action: ClockAction }
  const { action } = body
  if (!['clock_in', 'pause', 'resume', 'clock_out'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  // Get staff member record
  const { data: staffMember } = await admin
    .from('staff_members')
    .select('id, full_name')
    .eq('email', user.email)
    .maybeSingle()

  if (!staffMember) {
    return NextResponse.json({ error: 'Staff record not found' }, { status: 403 })
  }

  // Get today's session
  const { data: existingSession } = await admin
    .from('clock_sessions')
    .select('*')
    .eq('staff_member_id', staffMember.id)
    .eq('session_date', today)
    .maybeSingle()

  let session = existingSession

  if (action === 'clock_in') {
    if (session && session.status !== 'auto_logged_out') {
      return NextResponse.json({ error: 'Already clocked in today' }, { status: 400 })
    }

    // Fetch work config for this staff member
    const { data: config } = await admin
      .from('staff_work_config')
      .select('*')
      .eq('staff_member_id', staffMember.id)
      .maybeSingle()

    const hourlyRate     = config ? computeHourlyRate(config) : 0
    const standardSecs   = config ? computeStandardWorkSeconds(config) : 25200
    const intervalMins   = config?.presence_check_interval_minutes ?? 120
    const nextCheckAt    = nextPresenceCheckAt(now, intervalMins)

    if (session?.status === 'auto_logged_out') {
      // Resume session after auto-logout — keep accumulated time
      const { data: updated } = await admin
        .from('clock_sessions')
        .update({
          status:                      'active',
          current_interval_started_at: now.toISOString(),
          last_heartbeat_at:           now.toISOString(),
          next_presence_check_at:      nextCheckAt.toISOString(),
          hourly_rate_naira:           hourlyRate,
        })
        .eq('id', session.id)
        .select()
        .single()
      session = updated
    } else {
      // Fresh clock-in for today
      const { data: created } = await admin
        .from('clock_sessions')
        .insert({
          staff_member_id:             staffMember.id,
          staff_email:                 user.email,
          staff_full_name:             staffMember.full_name ?? '',
          session_date:                today,
          clock_in_time:               now.toISOString(),
          status:                      'active',
          current_interval_started_at: now.toISOString(),
          last_heartbeat_at:           now.toISOString(),
          next_presence_check_at:      nextCheckAt.toISOString(),
          hourly_rate_naira:           hourlyRate,
          standard_work_seconds:       standardSecs,
          total_worked_seconds:        0,
          total_break_seconds:         0,
        })
        .select()
        .single()
      session = created
    }

    await appendEvent(admin, session!.id, staffMember.id, user.email, 'clock_in', now)
    return NextResponse.json({ session })
  }

  if (!session || session.status === 'completed') {
    return NextResponse.json({ error: 'No active session' }, { status: 400 })
  }

  if (action === 'pause') {
    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Not currently working' }, { status: 400 })
    }
    const workedSecs = secondsSince(session.current_interval_started_at, now)
    const newTotal   = (session.total_worked_seconds as number) + workedSecs

    const { data: updated } = await admin
      .from('clock_sessions')
      .update({
        status:                      'on_break',
        total_worked_seconds:        newTotal,
        current_interval_started_at: now.toISOString(),
        last_heartbeat_at:           now.toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single()

    await appendEvent(admin, session.id, staffMember.id, user.email, 'break_start', now)
    return NextResponse.json({ session: updated })
  }

  if (action === 'resume') {
    if (session.status !== 'on_break') {
      return NextResponse.json({ error: 'Not on break' }, { status: 400 })
    }
    const breakSecs = secondsSince(session.current_interval_started_at, now)
    const newBreak  = (session.total_break_seconds as number) + breakSecs

    const intervalMins  = 120
    const nextCheckAt   = nextPresenceCheckAt(now, intervalMins)

    const { data: updated } = await admin
      .from('clock_sessions')
      .update({
        status:                      'active',
        total_break_seconds:         newBreak,
        current_interval_started_at: now.toISOString(),
        last_heartbeat_at:           now.toISOString(),
        next_presence_check_at:      nextCheckAt.toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single()

    await appendEvent(admin, session.id, staffMember.id, user.email, 'break_end', now)
    return NextResponse.json({ session: updated })
  }

  if (action === 'clock_out') {
    if (!['active', 'on_break'].includes(session.status)) {
      return NextResponse.json({ error: 'Cannot clock out in current state' }, { status: 400 })
    }

    let newWorked = session.total_worked_seconds as number
    let newBreak  = session.total_break_seconds as number

    if (session.status === 'active') {
      newWorked += secondsSince(session.current_interval_started_at, now)
    } else {
      newBreak += secondsSince(session.current_interval_started_at, now)
    }

    const standardSecs  = session.standard_work_seconds as number
    const overTimeSecs  = Math.max(newWorked - standardSecs, 0)

    const { data: updated } = await admin
      .from('clock_sessions')
      .update({
        status:               'completed',
        clock_out_time:       now.toISOString(),
        total_worked_seconds: newWorked,
        total_break_seconds:  newBreak,
        overtime_seconds:     overTimeSecs,
        last_heartbeat_at:    now.toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single()

    await appendEvent(admin, session.id, staffMember.id, user.email, 'clock_out', now)
    return NextResponse.json({ session: updated })
  }

  return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
}

function secondsSince(isoStart: string | null, now: Date): number {
  if (!isoStart) return 0
  return Math.max(0, Math.floor((now.getTime() - new Date(isoStart).getTime()) / 1000))
}

async function appendEvent(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  staffMemberId: string,
  staffEmail: string,
  eventType: string,
  eventTime: Date,
) {
  await admin.from('clock_events').insert({
    session_id:      sessionId,
    staff_member_id: staffMemberId,
    staff_email:     staffEmail,
    event_type:      eventType,
    event_time:      eventTime.toISOString(),
  })
}
