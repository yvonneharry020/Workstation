import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextPresenceCheckAt } from '@/lib/clock-utils'

const STALE_THRESHOLD_SECONDS = 90
const PRESENCE_TIMEOUT_SECONDS = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  const { data: session } = await admin
    .from('clock_sessions')
    .select('*')
    .eq('staff_email', user.email)
    .eq('session_date', today)
    .maybeSingle()

  // No active session — nothing to heartbeat
  if (!session || !['active', 'on_break'].includes(session.status as string)) {
    return NextResponse.json({ session: session ?? null, presenceCheck: null })
  }

  // Detect heartbeat loss from a previous interval (tab was closed, etc.)
  const lastHb = session.last_heartbeat_at ? new Date(session.last_heartbeat_at) : null
  if (lastHb) {
    const staleSecs = (now.getTime() - lastHb.getTime()) / 1000
    if (staleSecs > STALE_THRESHOLD_SECONDS * 4) {
      // Been gone > 6 minutes — log heartbeat_lost but keep session open;
      // admin can review. We don't auto-close here to avoid punishing network blips.
      await admin.from('clock_events').insert({
        session_id:      session.id,
        staff_member_id: session.staff_member_id,
        staff_email:     user.email,
        event_type:      'heartbeat_lost',
        event_time:      now.toISOString(),
        metadata:        { stale_seconds: Math.floor(staleSecs) },
      })
    }
  }

  // Update heartbeat timestamp
  await admin
    .from('clock_sessions')
    .update({ last_heartbeat_at: now.toISOString() })
    .eq('id', session.id)

  // ── Presence check logic ──────────────────────────────────
  // First, look for an existing pending check on this session
  const { data: pendingCheck } = await admin
    .from('presence_checks')
    .select('*')
    .eq('session_id', session.id)
    .eq('status', 'pending')
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingCheck) {
    const expiresAt = new Date(pendingCheck.expires_at)

    if (now >= expiresAt) {
      // This attempt has timed out — process it
      await admin
        .from('presence_checks')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', pendingCheck.id)

      await admin.from('clock_events').insert({
        session_id:      session.id,
        staff_member_id: session.staff_member_id,
        staff_email:     user.email,
        event_type:      'presence_timeout',
        event_time:      now.toISOString(),
        metadata:        { attempt: pendingCheck.attempt_number },
      })

      if ((pendingCheck.attempt_number as number) >= 3) {
        // Three strikes — auto-logout
        await handleAutoLogout(admin, session, user.email, now)
        return NextResponse.json({ session, presenceCheck: null, autoLogout: true })
      }

      // Create next attempt
      const nextCheck = await createPresenceCheck(
        admin,
        session.id,
        session.staff_member_id as string,
        user.email,
        (pendingCheck.attempt_number as number) + 1,
        now,
      )
      return NextResponse.json({ session, presenceCheck: nextCheck })
    }

    // Still within the 60-second window — return to client to keep modal up
    return NextResponse.json({ session, presenceCheck: pendingCheck })
  }

  // No pending check — is it time to create one?
  const nextCheckDue = session.next_presence_check_at
    ? new Date(session.next_presence_check_at)
    : null

  if (nextCheckDue && now >= nextCheckDue && session.status === 'active') {
    const check = await createPresenceCheck(
      admin,
      session.id,
      session.staff_member_id as string,
      user.email,
      1,
      now,
    )
    return NextResponse.json({ session, presenceCheck: check })
  }

  return NextResponse.json({ session, presenceCheck: null })
}

async function createPresenceCheck(
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  sessionId: string,
  staffMemberId: string,
  staffEmail: string,
  attemptNumber: number,
  now: Date,
) {
  const expiresAt = new Date(now.getTime() + PRESENCE_TIMEOUT_SECONDS * 1000)

  const { data } = await admin
    .from('presence_checks')
    .insert({
      session_id:      sessionId,
      staff_member_id: staffMemberId,
      staff_email:     staffEmail,
      attempt_number:  attemptNumber,
      expires_at:      expiresAt.toISOString(),
      status:          'pending',
    })
    .select()
    .single()

  return data
}

async function handleAutoLogout(
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  session: Record<string, unknown>,
  email: string,
  now: Date,
) {
  const sessionId     = session.id as string
  const staffMemberId = session.staff_member_id as string
  const currentStatus = session.status as string
  const worked        = session.total_worked_seconds as number
  const breakSecs     = session.total_break_seconds as number
  const startedAt     = session.current_interval_started_at as string | null
  const standardSecs  = session.standard_work_seconds as number

  let finalWorked = worked
  if (currentStatus === 'active' && startedAt) {
    finalWorked += Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000))
  }

  const overtimeSecs = Math.max(finalWorked - standardSecs, 0)

  await admin
    .from('clock_sessions')
    .update({
      status:               'auto_logged_out',
      clock_out_time:       now.toISOString(),
      total_worked_seconds: finalWorked,
      total_break_seconds:  breakSecs,
      overtime_seconds:     overtimeSecs,
      last_heartbeat_at:    now.toISOString(),
    })
    .eq('id', sessionId)

  await admin.from('clock_events').insert({
    session_id:      sessionId,
    staff_member_id: staffMemberId,
    staff_email:     email,
    event_type:      'auto_logout',
    event_time:      now.toISOString(),
    metadata:        { reason: 'presence_check_failed_3_times' },
  })

  await admin
    .from('presence_checks')
    .update({ status: 'auto_logout_triggered', updated_at: now.toISOString() })
    .eq('session_id', sessionId)
    .eq('status', 'pending')

  // Broadcast force_logout so the existing SessionWatcher signs the user out
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [{
        topic:   `staff-session:${email}`,
        event:   'force_logout',
        payload: { reason: 'presence_check_failed' },
      }],
    }),
  })

  // Also use next/next schedule for presence check — reset timer
  const intervalMins = 120
  await admin
    .from('clock_sessions')
    .update({ next_presence_check_at: nextPresenceCheckAt(now, intervalMins).toISOString() })
    .eq('id', sessionId)
}
