'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from './supabase/server'
import { checkRateLimit } from './rate-limiter'
import { validatePassword } from './password-validator'
import { logAdminEvent } from './audit'

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

export type LoginState = {
  error?: string
  fieldErrors?: { email?: string[]; password?: string[] }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const ip = await getClientIp()

  // Bot check — honeypot field must be empty
  if (formData.get('username_field') !== '') {
    // Silently reject bots — return fake success to avoid tipping them off
    await new Promise(r => setTimeout(r, 1500))
    return {}
  }

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

  void logAdminEvent({
    event: 'admin.login',
    actorEmail: parsed.data.email,
    actorType: 'admin',
    severity: 'info',
    metadata: { ip },
  })

  redirect('/dashboard')
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

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003'

  // Always call this regardless of whether the email exists — prevents user enumeration
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

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
