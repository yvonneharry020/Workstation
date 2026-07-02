'use client'

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** localStorage key for a given account's token slot */
export function tokenKey(email: string): string {
  return `_wk_token_${email.replace(/[@.+]/g, '_')}`
}

function getTabEmail(): string | null {
  try {
    const s = sessionStorage.getItem('_wk_session')
    return s ? (JSON.parse(s) as { email?: string }).email ?? null : null
  } catch {
    return null
  }
}

/**
 * Returns a Supabase client that uses THIS tab's account token.
 *
 * Each account's JWT lives in a separate localStorage slot keyed by email.
 * sessionStorage tells the tab which slot to use.
 * This means Finance tab and Admin tab can each make authenticated API calls
 * as their own user simultaneously — no shared cookie interference.
 */
export function createTabClient() {
  if (typeof window === 'undefined') {
    return createClient(SUPABASE_URL, SUPABASE_ANON)
  }

  const email = getTabEmail()
  if (!email) {
    // No tab session — fall back to the SSR browser client which reads the
    // shared Supabase cookie. This covers: users already logged in before
    // this multi-account system was deployed, page reloads in new tabs, etc.
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON)
  }

  const slotKey = tokenKey(email)

  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: {
        getItem(_key: string) {
          return localStorage.getItem(slotKey)
        },
        setItem(_key: string, value: string) {
          localStorage.setItem(slotKey, value)
        },
        removeItem(_key: string) {
          localStorage.removeItem(slotKey)
        },
      },
    },
  })
}

/** Save a session to the per-account localStorage slot at login time */
export function saveAccountToken(
  email: string,
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
    expires_in: number
    token_type: string
    user: Record<string, unknown>
  }
) {
  if (typeof window === 'undefined') return
  localStorage.setItem(tokenKey(email), JSON.stringify(session))
}

/** Remove a specific account's token slot on logout */
export function removeAccountToken(email: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(tokenKey(email))
}
