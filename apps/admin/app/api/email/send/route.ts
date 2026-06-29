import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import {
  staffInviteEmail,
  staffWelcomeEmail,
  candidateWelcomeEmail,
  candidateVerificationEmail,
  candidateApplicationReceivedEmail,
  candidateShortlistedEmail,
  candidateInterviewInviteEmail,
  candidateHiredEmail,
  candidateRejectedEmail,
  candidateProfileReminderEmail,
  companyWelcomeEmail,
  companyVerificationEmail,
  companyApprovedEmail,
  companyNewApplicationEmail,
  companyJobPostedEmail,
  adminNewCompanyEmail,
  adminNewCandidateEmail,
  passwordResetEmail,
} from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.to) {
    return NextResponse.json({ error: 'Missing type or to' }, { status: 400 })
  }

  const { type, to, data = {} } = body

  let email: { subject: string; html: string } | null = null

  switch (type) {
    case 'staff-invite':
      email = staffInviteEmail(data)
      break
    case 'staff-welcome':
      email = staffWelcomeEmail(data)
      break
    case 'candidate-welcome':
      email = candidateWelcomeEmail(data)
      break
    case 'candidate-verification':
      email = candidateVerificationEmail(data)
      break
    case 'candidate-application-received':
      email = candidateApplicationReceivedEmail(data)
      break
    case 'candidate-shortlisted':
      email = candidateShortlistedEmail(data)
      break
    case 'candidate-interview-invite':
      email = candidateInterviewInviteEmail(data)
      break
    case 'candidate-hired':
      email = candidateHiredEmail(data)
      break
    case 'candidate-rejected':
      email = candidateRejectedEmail(data)
      break
    case 'candidate-profile-reminder':
      email = candidateProfileReminderEmail(data)
      break
    case 'company-welcome':
      email = companyWelcomeEmail(data)
      break
    case 'company-verification':
      email = companyVerificationEmail(data)
      break
    case 'company-approved':
      email = companyApprovedEmail(data)
      break
    case 'company-new-application':
      email = companyNewApplicationEmail(data)
      break
    case 'company-job-posted':
      email = companyJobPostedEmail(data)
      break
    case 'admin-new-company':
      email = adminNewCompanyEmail(data)
      break
    case 'admin-new-candidate':
      email = adminNewCandidateEmail(data)
      break
    case 'password-reset':
      email = passwordResetEmail(data)
      break
    default:
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
  }

  const result = await sendEmail({ to, subject: email.subject, html: email.html })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: result.id })
}
