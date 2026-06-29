import { Resend } from 'resend'

const FROM_NOREPLY = process.env.RESEND_FROM_NOREPLY ?? 'noreply@kaylabeauty.shop'
const FROM_TEAM    = process.env.RESEND_FROM_TEAM    ?? 'team@kaylabeauty.shop'

// Lazily created so missing env var doesn't throw at module load / build time
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
  return new Resend(process.env.RESEND_API_KEY)
}

export type EmailType =
  | 'staff-invite'
  | 'staff-welcome'
  | 'candidate-welcome'
  | 'candidate-verification'
  | 'candidate-application-received'
  | 'candidate-shortlisted'
  | 'candidate-interview-invite'
  | 'candidate-hired'
  | 'candidate-rejected'
  | 'candidate-profile-reminder'
  | 'company-welcome'
  | 'company-verification'
  | 'company-approved'
  | 'company-new-application'
  | 'company-job-posted'
  | 'admin-new-company'
  | 'admin-new-candidate'
  | 'password-reset'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: 'noreply' | 'team'
  replyTo?: string
}

export async function sendEmail(p: SendEmailParams): Promise<{ id?: string; error?: string }> {
  const from = p.from === 'team' ? `Workstation <${FROM_TEAM}>` : `Workstation <${FROM_NOREPLY}>`
  const { data, error } = await getResend().emails.send({
    from,
    to:       [p.to],
    subject:  p.subject,
    html:     p.html,
    replyTo: p.replyTo,
  })

  if (error) {
    console.error('[email] send error:', error)
    return { error: error.message }
  }
  return { id: data?.id }
}
