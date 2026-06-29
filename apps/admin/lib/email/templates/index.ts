import { baseEmail, ctaButton, divider, infoBox, badge } from '../base'

// ─────────────────────────────────────────────
// STAFF EMAILS
// ─────────────────────────────────────────────

export function staffInviteEmail(p: {
  fullName: string
  email: string
  role: string
  rooms: string[]
  loginUrl: string
  invitedBy: string
}): { subject: string; html: string } {
  const roomList = p.rooms.map(r => `<li style="color:#a0a0c0;font-size:13px;line-height:1.8;">${r}</li>`).join('')
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Staff Invitation</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;line-height:1.2;">Welcome to Workstation, ${p.fullName.split(' ')[0]}!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 28px;line-height:1.6;">You've been invited to join the Workstation admin platform by <strong style="color:#a0a0c0;">${p.invitedBy}</strong>.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Email:</strong> ${p.email}`,
      `<strong style="color:#c0c0e0;">Role:</strong> ${p.role.charAt(0).toUpperCase() + p.role.slice(1)}`,
    ])}

    <p style="font-size:13px;font-weight:600;color:#7070a0;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Room Access Granted</p>
    <ul style="list-style:none;padding:0;margin:0 0 8px;">${roomList}</ul>

    <p style="font-size:14px;color:#7070a0;margin:24px 0 0;line-height:1.6;">Click the button below to set up your password and access the platform. This link expires in <strong style="color:#a0a0c0;">24 hours</strong>.</p>

    ${ctaButton(p.loginUrl, 'Accept Invitation & Set Password')}

    ${divider()}

    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">If you weren't expecting this invitation, ignore this email. The link will expire automatically. For support, contact your administrator.</p>
  `, `You've been invited to join Workstation as ${p.role}`)

  return { subject: `You're invited to join Workstation — ${p.fullName}`, html }
}

export function staffWelcomeEmail(p: {
  fullName: string
  loginUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Account Activated</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">You're all set, ${p.fullName.split(' ')[0]}!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 28px;line-height:1.6;">Your Workstation account is active and ready to go. Log in anytime to access your dashboard.</p>
    ${ctaButton(p.loginUrl, 'Go to Dashboard')}
    ${divider()}
    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">Keep your login credentials safe. Never share your password with anyone.</p>
  `, 'Your Workstation account is now active')
  return { subject: 'Your Workstation account is ready', html }
}

// ─────────────────────────────────────────────
// CANDIDATE EMAILS
// ─────────────────────────────────────────────

export function candidateWelcomeEmail(p: {
  fullName: string
  loginUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#10b981;margin:0 0 12px;">Welcome Aboard</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Hi ${p.fullName.split(' ')[0]}, welcome to Workstation!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Nigeria's professional job platform is ready for you. Complete your profile to get matched with top companies hiring right now.</p>

    ${infoBox([
      '✅ &nbsp;Build your professional profile',
      '🔍 &nbsp;Browse thousands of verified job listings',
      '📩 &nbsp;Apply with one tap — track every application',
      '🏆 &nbsp;Earn your Workstation verified badge',
    ])}

    ${ctaButton(p.loginUrl, 'Complete My Profile')}

    ${divider()}
    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">If you didn't create this account, you can safely ignore this email.</p>
  `, 'Your Workstation job search starts here')
  return { subject: `Welcome to Workstation, ${p.fullName.split(' ')[0]}! 🎉`, html }
}

export function candidateVerificationEmail(p: {
  fullName: string
  verifyUrl: string
  expiresIn?: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Email Verification</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Verify your email address</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName.split(' ')[0]}, please verify your email to activate your Workstation account.</p>

    ${ctaButton(p.verifyUrl, 'Verify Email Address')}

    <p style="font-size:13px;color:#5a5a7a;margin:20px 0 0;text-align:center;">This link expires in ${p.expiresIn ?? '24 hours'}.</p>

    ${divider()}
    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">If you didn't sign up for Workstation, ignore this email.</p>
  `, 'Verify your Workstation email address')
  return { subject: 'Verify your Workstation email', html }
}

export function candidateApplicationReceivedEmail(p: {
  fullName: string
  jobTitle: string
  companyName: string
  applicationId: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#10b981;margin:0 0 12px;">Application Received</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Your application was submitted!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName.split(' ')[0]}, your application for the role below is now with the hiring team.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Position:</strong> ${p.jobTitle}`,
      `<strong style="color:#c0c0e0;">Company:</strong> ${p.companyName}`,
      `<strong style="color:#c0c0e0;">Application ID:</strong> ${p.applicationId}`,
    ])}

    <p style="font-size:14px;color:#7070a0;margin:20px 0;line-height:1.6;">We'll notify you when the company reviews your application. Track your application status from your dashboard.</p>

    ${ctaButton(p.dashboardUrl, 'Track My Application')}
  `, `Application submitted for ${p.jobTitle} at ${p.companyName}`)
  return {
    subject: `Application received — ${p.jobTitle} at ${p.companyName}`,
    html,
  }
}

export function candidateShortlistedEmail(p: {
  fullName: string
  jobTitle: string
  companyName: string
  nextSteps: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#f59e0b;margin:0 0 12px;">Great News</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">You've been shortlisted! 🌟</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName.split(' ')[0]}, your application for <strong style="color:#a0a0c0;">${p.jobTitle}</strong> at <strong style="color:#a0a0c0;">${p.companyName}</strong> stood out and you've been shortlisted.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Next Steps:</strong> ${p.nextSteps}`,
    ])}

    <p style="font-size:14px;color:#7070a0;margin:20px 0;line-height:1.6;">Keep an eye on your dashboard and email — the company may reach out to schedule the next step.</p>

    ${ctaButton(p.dashboardUrl, 'View Application Status')}
  `, `You've been shortlisted for ${p.jobTitle}`)
  return {
    subject: `You're shortlisted! — ${p.jobTitle} at ${p.companyName} 🌟`,
    html,
  }
}

export function candidateInterviewInviteEmail(p: {
  fullName: string
  jobTitle: string
  companyName: string
  interviewDate: string
  interviewTime: string
  interviewType: 'In-Person' | 'Virtual' | 'Phone'
  location: string
  contactName: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const typeColor: Record<string, '#10b981' | '#6366f1' | '#f59e0b'> = {
    'In-Person': '#10b981', Virtual: '#6366f1', Phone: '#f59e0b',
  }
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Interview Invitation</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">You're invited for an interview 🎯</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName.split(' ')[0]}, congratulations! <strong style="color:#a0a0c0;">${p.companyName}</strong> would like to interview you for the <strong style="color:#a0a0c0;">${p.jobTitle}</strong> role.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Date:</strong> ${p.interviewDate}`,
      `<strong style="color:#c0c0e0;">Time:</strong> ${p.interviewTime}`,
      `<strong style="color:#c0c0e0;">Format:</strong> ${p.interviewType}`,
      `<strong style="color:#c0c0e0;">Location / Link:</strong> ${p.location}`,
      `<strong style="color:#c0c0e0;">Contact:</strong> ${p.contactName}`,
    ])}

    <p style="font-size:14px;color:#7070a0;margin:20px 0;line-height:1.6;">Log in to your dashboard to confirm your attendance or request a reschedule.</p>

    ${ctaButton(p.dashboardUrl, 'Confirm Attendance')}
  `, `Interview invitation from ${p.companyName}`)
  return {
    subject: `Interview scheduled — ${p.jobTitle} at ${p.companyName} 🎯`,
    html,
  }
}

export function candidateHiredEmail(p: {
  fullName: string
  jobTitle: string
  companyName: string
  startDate: string
  contactName: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">🎉</div>
      <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#10b981;margin:0 0 10px;">Congratulations</p>
      <h1 style="font-size:28px;font-weight:800;color:#f0f0fa;margin:0;line-height:1.2;">You got the job,<br/>${p.fullName.split(' ')[0]}!</h1>
    </div>

    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;text-align:center;">We're thrilled to inform you that <strong style="color:#a0a0c0;">${p.companyName}</strong> has selected you for the <strong style="color:#a0a0c0;">${p.jobTitle}</strong> position.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Role:</strong> ${p.jobTitle}`,
      `<strong style="color:#c0c0e0;">Company:</strong> ${p.companyName}`,
      `<strong style="color:#c0c0e0;">Start Date:</strong> ${p.startDate}`,
      `<strong style="color:#c0c0e0;">Your Contact:</strong> ${p.contactName}`,
    ])}

    <p style="font-size:14px;color:#7070a0;margin:20px 0;line-height:1.6;">Check your dashboard for your formal offer letter and next steps from the company.</p>

    ${ctaButton(p.dashboardUrl, 'View Offer Details')}

    <p style="font-size:13px;color:#5a5a7a;text-align:center;margin:24px 0 0;">Best of luck in your new role — from the entire Workstation team 🚀</p>
  `, `Congratulations! You got the ${p.jobTitle} job`)
  return {
    subject: `You're hired! Congratulations ${p.fullName.split(' ')[0]} 🎉`,
    html,
  }
}

export function candidateRejectedEmail(p: {
  fullName: string
  jobTitle: string
  companyName: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Application Update</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Thanks for applying, ${p.fullName.split(' ')[0]}</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">After careful review, <strong style="color:#a0a0c0;">${p.companyName}</strong> has decided to move forward with other candidates for the <strong style="color:#a0a0c0;">${p.jobTitle}</strong> role at this time.</p>

    <p style="font-size:14px;color:#7070a0;margin:0 0 24px;line-height:1.6;">This doesn't reflect your potential — the competition was strong. Your profile remains active and hundreds of companies are looking for talent like yours on Workstation.</p>

    ${ctaButton(p.dashboardUrl, 'Browse More Opportunities')}

    <p style="font-size:13px;color:#5a5a7a;text-align:center;margin:24px 0 0;">Keep going — your next opportunity is one application away.</p>
  `, `Application update for ${p.jobTitle}`)
  return {
    subject: `Application update — ${p.jobTitle} at ${p.companyName}`,
    html,
  }
}

export function candidateProfileReminderEmail(p: {
  fullName: string
  completionPercent: number
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#f59e0b;margin:0 0 12px;">Profile Reminder</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Your profile is ${p.completionPercent}% complete</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName.split(' ')[0]}, candidates with complete profiles get <strong style="color:#a0a0c0;">3× more views</strong> from recruiters. Finish yours now to unlock more opportunities.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#1e1e2e; border-radius:8px; overflow:hidden; height:10px;">
          <div style="width:${p.completionPercent}%; height:10px; background: linear-gradient(90deg, #6366f1, #a5b4fc); border-radius:8px;"></div>
        </td>
      </tr>
    </table>

    ${infoBox([
      '📸 &nbsp;Add a professional profile photo',
      '📝 &nbsp;Write a compelling bio',
      '💼 &nbsp;Add your work history',
      '🎓 &nbsp;List your education and certifications',
    ])}

    ${ctaButton(p.dashboardUrl, 'Complete My Profile')}
  `, `Your Workstation profile needs attention`)
  return { subject: `Complete your profile — ${p.completionPercent}% done so far`, html }
}

// ─────────────────────────────────────────────
// COMPANY EMAILS
// ─────────────────────────────────────────────

export function companyWelcomeEmail(p: {
  companyName: string
  contactName: string
  loginUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Company Account</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Welcome, ${p.companyName}!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.contactName}, your company account is set up on Workstation. Start hiring Nigeria's best talent today.</p>

    ${infoBox([
      '📋 &nbsp;Post unlimited job listings',
      '🔍 &nbsp;Search and filter verified candidates',
      '📊 &nbsp;Track all applications in your dashboard',
      '✅ &nbsp;Hire faster with built-in verification badges',
    ])}

    ${ctaButton(p.loginUrl, 'Access Company Dashboard')}

    ${divider()}
    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">Your account is currently pending verification. Our team will review and approve within 24 hours.</p>
  `, `${p.companyName} is now on Workstation`)
  return { subject: `Welcome to Workstation, ${p.companyName}!`, html }
}

export function companyVerificationEmail(p: {
  companyName: string
  contactName: string
  verifyUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Email Verification</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Verify ${p.companyName}'s email</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.contactName}, please verify your company email address to continue setting up your Workstation account.</p>
    ${ctaButton(p.verifyUrl, 'Verify Company Email')}
    <p style="font-size:13px;color:#5a5a7a;margin:20px 0 0;text-align:center;">This link expires in 24 hours.</p>
  `, 'Verify your company email address')
  return { subject: `Verify ${p.companyName}'s email on Workstation`, html }
}

export function companyApprovedEmail(p: {
  companyName: string
  contactName: string
  loginUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:12px;">✅</div>
      <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#10b981;margin:0 0 10px;">Account Approved</p>
      <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0;">${p.companyName} is verified!</h1>
    </div>

    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;text-align:center;">Hi ${p.contactName}, your company account has been reviewed and approved. You can now post jobs and receive applications from verified candidates.</p>

    ${ctaButton(p.loginUrl, 'Start Hiring Now')}
  `, `${p.companyName} account approved on Workstation`)
  return { subject: `✅ ${p.companyName} approved — start hiring on Workstation`, html }
}

export function companyNewApplicationEmail(p: {
  companyName: string
  jobTitle: string
  candidateName: string
  applicationId: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">New Application</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">You have a new applicant</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">A new candidate has applied for your open position. Review their profile and take action.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Candidate:</strong> ${p.candidateName}`,
      `<strong style="color:#c0c0e0;">Applied for:</strong> ${p.jobTitle}`,
      `<strong style="color:#c0c0e0;">Application ID:</strong> ${p.applicationId}`,
    ])}

    ${ctaButton(p.dashboardUrl, 'Review Application')}
  `, `New application for ${p.jobTitle}`)
  return {
    subject: `New application — ${p.candidateName} applied for ${p.jobTitle}`,
    html,
  }
}

export function companyJobPostedEmail(p: {
  companyName: string
  contactName: string
  jobTitle: string
  jobId: string
  dashboardUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#10b981;margin:0 0 12px;">Job Published</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Your job is now live!</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.contactName}, your job posting is now visible to thousands of active candidates on Workstation.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Job Title:</strong> ${p.jobTitle}`,
      `<strong style="color:#c0c0e0;">Company:</strong> ${p.companyName}`,
      `<strong style="color:#c0c0e0;">Job ID:</strong> ${p.jobId}`,
    ])}

    ${ctaButton(p.dashboardUrl, 'Manage Job Listing')}
  `, `${p.jobTitle} is now live on Workstation`)
  return { subject: `Your job "${p.jobTitle}" is live on Workstation`, html }
}

// ─────────────────────────────────────────────
// ADMIN NOTIFICATION EMAILS
// ─────────────────────────────────────────────

export function adminNewCompanyEmail(p: {
  companyName: string
  contactName: string
  contactEmail: string
  registeredAt: string
  reviewUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#f59e0b;margin:0 0 12px;">Admin Alert</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">New company registered</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">A new company has signed up and is awaiting verification.</p>

    ${infoBox([
      `<strong style="color:#c0c0e0;">Company:</strong> ${p.companyName}`,
      `<strong style="color:#c0c0e0;">Contact:</strong> ${p.contactName}`,
      `<strong style="color:#c0c0e0;">Email:</strong> ${p.contactEmail}`,
      `<strong style="color:#c0c0e0;">Registered:</strong> ${p.registeredAt}`,
    ])}

    ${ctaButton(p.reviewUrl, 'Review & Approve Company')}
  `, `New company: ${p.companyName} needs review`)
  return { subject: `[Admin] New company registered — ${p.companyName}`, html }
}

export function adminNewCandidateEmail(p: {
  candidateName: string
  email: string
  registeredAt: string
  profileUrl: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin:0 0 12px;">Admin Alert</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">New candidate registered</h1>
    ${infoBox([
      `<strong style="color:#c0c0e0;">Name:</strong> ${p.candidateName}`,
      `<strong style="color:#c0c0e0;">Email:</strong> ${p.email}`,
      `<strong style="color:#c0c0e0;">Registered:</strong> ${p.registeredAt}`,
    ])}
    ${ctaButton(p.profileUrl, 'View Candidate Profile')}
  `, `New candidate: ${p.candidateName}`)
  return { subject: `[Admin] New candidate — ${p.candidateName}`, html }
}

// ─────────────────────────────────────────────
// AUTH EMAILS
// ─────────────────────────────────────────────

export function passwordResetEmail(p: {
  fullName: string
  resetUrl: string
  expiresIn?: string
  ipAddress?: string
}): { subject: string; html: string } {
  const html = baseEmail(`
    <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ef4444;margin:0 0 12px;">Password Reset</p>
    <h1 style="font-size:26px;font-weight:800;color:#f0f0fa;margin:0 0 8px;">Reset your password</h1>
    <p style="font-size:15px;color:#7070a0;margin:0 0 24px;line-height:1.6;">Hi ${p.fullName ?? 'there'}, we received a request to reset the password for your Workstation account.</p>

    ${ctaButton(p.resetUrl, 'Reset My Password')}

    <p style="font-size:13px;color:#5a5a7a;text-align:center;margin:20px 0 0;">This link expires in <strong style="color:#a0a0c0;">${p.expiresIn ?? '1 hour'}</strong> and can only be used once.</p>

    ${divider()}

    <p style="font-size:12px;color:#4a4a6a;line-height:1.7;margin:0;">
      If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      ${p.ipAddress ? `<br/>This request was made from IP: <strong>${p.ipAddress}</strong>.` : ''}
      <br/>If this wasn't you, consider securing your account by changing your password immediately.
    </p>
  `, 'Reset your Workstation password')
  return { subject: 'Reset your Workstation password', html }
}
