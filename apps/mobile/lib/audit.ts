import { supabase } from './supabase'

export type AuditEvent =
  // Auth
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.registered'
  | 'user.account_deleted'
  | 'user.password_changed'
  // Candidate
  | 'candidate.profile_updated'
  | 'candidate.verification_submitted'
  | 'candidate.job_applied'
  | 'candidate.job_application_withdrawn'
  | 'candidate.badge_dispute_filed'
  | 'candidate.cv_updated'
  | 'candidate.support_chat_started'
  | 'candidate.support_message_sent'
  // Company
  | 'company.profile_updated'
  | 'company.job_posted'
  | 'company.job_edited'
  | 'company.job_deleted'
  | 'company.badge_issued'
  | 'company.candidate_shortlisted'
  | 'company.support_chat_started'
  | 'company.support_message_sent'

export type AuditApp = 'candidate_app' | 'company_app'

export interface AuditOptions {
  event: AuditEvent
  app: AuditApp
  targetId?: string
  targetType?: string
  targetName?: string
  severity?: 'info' | 'warning' | 'critical'
  metadata?: Record<string, unknown>
}

// Fire-and-forget — never await this in the UI; it must not block the user
export function logEvent(opts: AuditOptions): void {
  supabase.auth.getUser().then(({ data: { user } }) => {
    supabase.from('audit_logs').insert({
      event: opts.event,
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      actor_type: opts.app === 'candidate_app' ? 'candidate' : 'company',
      target_id: opts.targetId ?? null,
      target_type: opts.targetType ?? null,
      target_name: opts.targetName ?? null,
      severity: opts.severity ?? 'info',
      metadata: opts.metadata ?? {},
      ip_address: null,
      app: opts.app,
    })
  })
}
