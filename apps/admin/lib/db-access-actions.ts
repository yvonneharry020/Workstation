'use server'

import { headers } from 'next/headers'
import { createAdminClient } from './supabase/admin'

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

export async function logDbAccess(params: {
  staffEmail: string
  staffId: string | null
  room: string
  sessionId: string
}): Promise<void> {
  const ip = await getClientIp()
  const supabase = createAdminClient()

  await Promise.all([
    supabase.from('db_access_log').insert({
      staff_email: params.staffEmail,
      staff_id: params.staffId ?? null,
      room: params.room,
      session_id: params.sessionId,
      ip_address: ip,
    }),
    supabase.from('audit_logs').insert({
      event: 'database.access',
      actor_email: params.staffEmail,
      actor_id: params.staffId ?? null,
      actor_type: 'admin',
      severity: 'info',
      app: 'admin_panel',
      ip_address: ip,
      metadata: { room: params.room, session_id: params.sessionId },
    }),
  ])
}
