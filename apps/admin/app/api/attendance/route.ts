import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const date      = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const staffId   = searchParams.get('staffId')

  const admin = createAdminClient()

  let query = admin
    .from('clock_sessions')
    .select(`
      *,
      clock_events (
        id, event_type, event_time, metadata
      )
    `)
    .eq('session_date', date)
    .order('clock_in_time', { ascending: false })

  if (staffId) {
    query = query.eq('staff_member_id', staffId)
  }

  const { data: sessions, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessions: sessions ?? [] })
}
