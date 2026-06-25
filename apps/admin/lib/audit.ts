'use server'

import { headers } from 'next/headers'
import { createClient } from './supabase/server'

export type AuditSeverity = 'info' | 'warning' | 'critical'
export type AuditApp = 'candidate_app' | 'company_app' | 'admin_panel' | 'system'
export type AuditActorType = 'candidate' | 'company' | 'admin' | 'system'

export interface AuditPayload {
  event: string
  actorType?: AuditActorType
  actorEmail?: string
  actorId?: string
  targetId?: string
  targetType?: string
  targetName?: string
  severity?: AuditSeverity
  metadata?: Record<string, unknown>
}

export async function logAdminEvent(payload: AuditPayload): Promise<void> {
  try {
    const supabase = await createClient()
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      event: payload.event,
      actor_id: payload.actorId ?? user?.id ?? null,
      actor_email: payload.actorEmail ?? user?.email ?? null,
      actor_type: payload.actorType ?? 'admin',
      target_id: payload.targetId ?? null,
      target_type: payload.targetType ?? null,
      target_name: payload.targetName ?? null,
      severity: payload.severity ?? 'info',
      metadata: payload.metadata ?? {},
      ip_address: ip,
      app: 'admin_panel',
    })
  } catch {
    // Audit logging is non-critical — never let it crash the main operation
  }
}
