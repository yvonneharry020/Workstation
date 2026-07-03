'use server'

import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import { checkRateLimit } from './rate-limiter'
import { validatePassword } from './password-validator'
import { logAdminEvent } from './audit'
import { sendEmail } from './email'
import { passwordResetEmail, staffInviteEmail } from './email/templates'

// ─── Multi-session cookie helpers ─────────────────────────────────────────────

type SessionMeta = {
  id: string
  name: string
  role: string
  department: string | null
  permissions: { admin: boolean; management: boolean; technical: boolean; finance: boolean }
}

const SESSIONS_COOKIE_OPTS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false, // client JS needs to read it for logout
}

async function readSessionsCookie(): Promise<Record<string, SessionMeta>> {
  const store = await cookies()
  const raw = store.get('_wk_sessions')?.value
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, SessionMeta> } catch { return {} }
}

async function writeSessionsCookie(sessions: Record<string, SessionMeta>) {
  const store = await cookies()
  store.set('_wk_sessions', JSON.stringify(sessions), SESSIONS_COOKIE_OPTS)
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(254).toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
  honeypot: z.literal(''),
})

export type TabSession = {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  permissions: { admin: boolean; management: boolean; technical: boolean; finance: boolean }
  // Auth tokens — stored per-account in localStorage so each tab can use its own session
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  token_type: string
  supabaseUser: Record<string, unknown>
}

export type LoginState = {
  error?: string
  fieldErrors?: { email?: string[]; password?: string[] }
  redirectTo?: string
  tabSession?: TabSession
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const ip = await getClientIp()

  const limit = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)
  if (!limit.allowed) {
    const min = Math.ceil(limit.retryAfterMs / 60_000)
    return { error: `Too many attempts. Try again in ${min} minute${min !== 1 ? 's' : ''}.` }
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    honeypot: formData.get('username_field') ?? '',
  })

  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors
    return {
      fieldErrors: {
        email: fe.email,
        password: fe.password,
      },
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    void logAdminEvent({
      event: 'admin.login_failed',
      actorEmail: parsed.data.email,
      actorType: 'admin',
      severity: 'warning',
      metadata: { ip },
    })
    return { error: 'Invalid credentials. Check your email and password.' }
  }

  // Check if the staff account has been deactivated — also grab name + department for tab session
  const { data: staffRecord } = await supabase
    .from('staff_members')
    .select('is_active, role, permissions, full_name, department')
    .eq('email', parsed.data.email)
    .maybeSingle()

  if (staffRecord && !staffRecord.is_active) {
    await supabase.auth.signOut()
    void logAdminEvent({
      event: 'admin.login_blocked_deactivated',
      actorEmail: parsed.data.email,
      actorType: 'admin',
      severity: 'warning',
      metadata: { ip },
    })
    return { error: 'Your access has been deactivated. Contact your administrator for further assistance.' }
  }

  void logAdminEvent({
    event: 'admin.login',
    actorEmail: parsed.data.email,
    actorType: 'admin',
    severity: 'info',
    metadata: { ip },
  })

  // Update last_login_at so the staff badge switches from Pending → Active
  if (staffRecord) {
    const admin = createAdminClient()
    void admin
      .from('staff_members')
      .update({ last_login_at: new Date().toISOString() })
      .eq('email', parsed.data.email)
  }

  // Get authenticated user + session tokens
  const [{ data: { user: authUser } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  const isSuperAdmin = parsed.data.email === 'yvonne2okis@gmail.com'
  const superAdminName =
    (authUser?.user_metadata?.full_name as string | undefined) ??
    (authUser?.user_metadata?.name as string | undefined) ??
    'Yvonne Harry'

  const permissions: TabSession['permissions'] = isSuperAdmin
    ? { admin: true, management: true, technical: true, finance: true }
    : (staffRecord?.permissions as TabSession['permissions']) ?? { admin: false, management: false, technical: false, finance: false }

  const tabSession: TabSession = {
    id:           authUser?.id ?? '',
    name:         isSuperAdmin
                    ? superAdminName
                    : ((staffRecord as Record<string, unknown> | null)?.full_name as string | null)
                      ?? parsed.data.email.split('@')[0],
    email:        parsed.data.email,
    role:         isSuperAdmin ? 'superadmin' : ((staffRecord?.role as string | null) ?? 'staff'),
    department:   isSuperAdmin ? 'admin' : ((staffRecord as Record<string, unknown> | null)?.department as string | null) ?? null,
    permissions,
    // Auth tokens for per-tab localStorage slot
    access_token:  session?.access_token ?? '',
    refresh_token: session?.refresh_token ?? '',
    expires_at:    session?.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    expires_in:    session?.expires_in ?? 3600,
    token_type:    'bearer',
    supabaseUser:  (authUser ?? {}) as Record<string, unknown>,
  }

  // Register this account in the multi-session cookie so middleware can serve
  // the correct room even when another account's Supabase cookie is "active"
  const sessions = await readSessionsCookie()
  sessions[parsed.data.email] = {
    id:          tabSession.id,
    name:        tabSession.name,
    role:        tabSession.role,
    department:  tabSession.department,
    permissions: tabSession.permissions,
  }
  await writeSessionsCookie(sessions)

  // Route to the correct room dashboard based on permissions
  let destination = '/dashboard'
  if (staffRecord && staffRecord.role !== 'admin') {
    const perms = (staffRecord.permissions as Record<string, boolean>) ?? {}
    if (perms.management) destination = '/ops/dashboard'
    else if (perms.technical) destination = '/tech/dashboard'
    else if (perms.finance) destination = '/finance/dashboard'
  }

  return { redirectTo: destination, tabSession }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotSchema = z.object({
  email: z.string().email('Invalid email address').max(254).toLowerCase(),
})

export type ForgotState = {
  error?: string
  success?: boolean
  fieldErrors?: { email?: string[] }
}

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const ip = await getClientIp()
  const email = String(formData.get('email') ?? '').toLowerCase().trim()

  // IP-level throttle: 3 per hour
  const ipLimit = checkRateLimit(`forgot:ip:${ip}`, 3, 60 * 60 * 1000)
  if (!ipLimit.allowed) {
    const min = Math.ceil(ipLimit.retryAfterMs / 60_000)
    return { error: `Too many requests. Try again in ${min} minute${min !== 1 ? 's' : ''}.` }
  }

  // Per-email throttle: 1 per 5 minutes — return success silently to prevent enumeration
  const emailLimit = checkRateLimit(`forgot:email:${email}`, 1, 5 * 60 * 1000)
  if (!emailLimit.allowed) return { success: true }

  const parsed = forgotSchema.safeParse({ email })
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as ForgotState['fieldErrors'] }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://skiniq.store'

  // Use admin client to generate the reset link without Supabase sending its own plain email
  try {
    const admin = createAdminClient()
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: parsed.data.email,
      options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
    })

    if (!linkError && linkData?.properties?.action_link) {
      // Look up the user's name for personalisation
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('email', parsed.data.email)
        .single()

      const fullName = (profile as { full_name?: string } | null)?.full_name ?? parsed.data.email.split('@')[0]
      const { subject, html } = passwordResetEmail({
        fullName,
        resetUrl: linkData.properties.action_link,
        expiresIn: '1 hour',
        ipAddress: ip,
      })

      await sendEmail({ to: parsed.data.email, subject, html })
    }
    // Always return success to prevent email enumeration
  } catch {
    // Service role key not configured — fall back to Supabase native email
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
  }

  return { success: true }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetSchema = z.object({
  password: z.string().min(1).max(128),
  confirmPassword: z.string().min(1),
})

export type ResetState = {
  error?: string
  success?: boolean
  fieldErrors?: { password?: string[]; confirmPassword?: string[] }
}

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const ip = await getClientIp()
  const limit = checkRateLimit(`reset:${ip}`, 5, 15 * 60 * 1000)
  if (!limit.allowed) {
    return { error: 'Too many attempts. Please try again later.' }
  }

  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as ResetState['fieldErrors'] }
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { fieldErrors: { confirmPassword: ['Passwords do not match'] } }
  }

  const validation = validatePassword(parsed.data.password)
  if (!validation.valid) {
    return { fieldErrors: { password: validation.errors } }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { error: 'Failed to update password. Your reset link may have expired. Request a new one.' }
  }

  // Sign out all other active sessions for this account
  await supabase.auth.signOut({ scope: 'others' })

  void logAdminEvent({
    event: 'admin.password_changed',
    actorType: 'admin',
    severity: 'warning',
    metadata: { ip },
  })

  return { success: true }
}

// ─── Resend Staff Invite ──────────────────────────────────────────────────────

export type ResendInviteState = { success?: boolean; error?: string }

export async function resendStaffInviteAction(
  staffId: string,
  email: string,
  fullName: string,
  role: string,
  rooms: string[],
): Promise<ResendInviteState> {
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://skiniq.store'
    const redirectTo = `${origin}/auth/callback?next=/setup-account`

    const admin = createAdminClient()

    // Try invite link first (new users); fall back to recovery link for existing auth users
    let actionLink: string | null = null

    const { data: inviteData } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    })

    if (inviteData?.properties?.action_link) {
      actionLink = inviteData.properties.action_link
    } else {
      const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })

      if (recoveryData?.properties?.action_link) {
        actionLink = recoveryData.properties.action_link
      } else {
        return { error: recoveryError?.message || 'Failed to generate invite link.' }
      }
    }

    const { subject, html } = staffInviteEmail({
      fullName,
      email,
      role,
      rooms,
      loginUrl: actionLink,
      invitedBy: 'Workstation Admin',
    })

    const emailResult = await sendEmail({ to: email, subject, html })
    if (emailResult.error) {
      return { error: `Email failed to send: ${emailResult.error}` }
    }

    await admin
      .from('staff_members')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', staffId)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await admin.from('audit_logs').insert({
      event: 'admin.staff_invite_resent',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: staffId,
      target_type: 'staff_member',
      target_name: fullName,
      severity: 'info',
      app: 'admin_panel',
      metadata: { email, redirectTo },
    })

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unexpected error. Check server logs.' }
  }
}

// ─── Realtime Broadcast Helper ────────────────────────────────────────────────

async function broadcastToStaff(
  email: string,
  event: 'force_logout' | 'permissions_updated',
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ topic: `realtime:staff-session:${email}`, event, payload }],
    }),
  }).catch(() => { /* broadcast failure is non-fatal */ })
}

// ─── Save Staff Permissions ───────────────────────────────────────────────────

export type SavePermissionsState = { success?: boolean; error?: string }

export async function saveStaffPermissionsAction(
  staffId: string,
  fullName: string,
  email: string,
  newRole: 'admin' | 'staff' | 'viewer',
  newPermissions: Record<string, boolean>,
  oldRole: 'admin' | 'staff' | 'viewer',
  oldPermissions: Record<string, boolean>,
): Promise<SavePermissionsState> {
  try {
    const admin = createAdminClient()

    const { error: updateError } = await admin
      .from('staff_members')
      .update({ role: newRole, permissions: newPermissions, updated_at: new Date().toISOString() })
      .eq('id', staffId)

    if (updateError) return { error: updateError.message }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await admin.from('audit_logs').insert({
      event: 'admin.staff_updated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: staffId,
      target_type: 'staff_member',
      target_name: fullName,
      severity: 'info',
      app: 'admin_panel',
      metadata: { role: newRole, permissions: newPermissions },
    })

    const roleChangedToViewer = newRole === 'viewer' && oldRole !== 'viewer'
    const roomRemoved = Object.keys(oldPermissions).some(k => oldPermissions[k] && !newPermissions[k])

    if (roleChangedToViewer) {
      await broadcastToStaff(email, 'force_logout', { reason: 'viewer' })
    } else if (roomRemoved) {
      await broadcastToStaff(email, 'force_logout', { reason: 'permissions_changed' })
    } else {
      await broadcastToStaff(email, 'permissions_updated', { role: newRole, permissions: newPermissions })
    }

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to save permissions.' }
  }
}

// ─── Toggle Staff Active ──────────────────────────────────────────────────────

export type ToggleActiveState = { success?: boolean; error?: string; newIsActive?: boolean }

export async function toggleStaffActiveAction(
  staffId: string,
  fullName: string,
  email: string,
  newIsActive: boolean,
): Promise<ToggleActiveState> {
  try {
    const admin = createAdminClient()

    const { error: updateError } = await admin
      .from('staff_members')
      .update({ is_active: newIsActive, updated_at: new Date().toISOString() })
      .eq('id', staffId)

    if (updateError) {
      return { error: updateError.message }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await admin.from('audit_logs').insert({
      event: newIsActive ? 'admin.staff_reactivated' : 'admin.staff_deactivated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: staffId,
      target_type: 'staff_member',
      target_name: fullName,
      severity: 'warning',
      app: 'admin_panel',
      metadata: { email, is_active: newIsActive },
    })

    if (!newIsActive) {
      await broadcastToStaff(email, 'force_logout', { reason: 'deactivated' })
    }

    return { success: true, newIsActive }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update access status.' }
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

/**
 * Removes a single account from the multi-session cookie.
 * Only signs out from Supabase if this was the last active session.
 * Other tabs remain unaffected — each uses its own localStorage token.
 */
export async function logoutSingleAction(email: string): Promise<{ wasLast: boolean }> {
  const ip = await getClientIp()
  const sessions = await readSessionsCookie()
  delete sessions[email]
  const remaining = Object.keys(sessions).length

  if (remaining === 0) {
    // Last account logged out — clear the Supabase shared session too
    const supabase = await createClient()
    await supabase.auth.signOut()
    const store = await cookies()
    store.delete('_wk_sessions')
  } else {
    await writeSessionsCookie(sessions)
  }

  void logAdminEvent({
    event: 'admin.logout',
    actorEmail: email,
    actorType: 'admin',
    severity: 'info',
    metadata: { ip },
  })

  return { wasLast: remaining === 0 }
}
