'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createClient()
    const next = searchParams.get('next') ?? '/dashboard'
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

    // Supabase puts tokens in the hash for admin-generated invite/recovery links (implicit flow).
    // The hash is never sent to the server, so it must be read client-side.
    const hash = window.location.hash.slice(1)
    const hashParams = new URLSearchParams(hash)

    const hashError = hashParams.get('error')
    const hashErrorCode = hashParams.get('error_code')
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    // PKCE flow fallback: code arrives as a query param (e.g. from magic links sent by the client SDK)
    const code = searchParams.get('code')

    if (hashError || hashErrorCode) {
      router.replace('/login?error=link_expired')
      return
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            router.replace('/login?error=auth_failed')
          } else {
            router.replace(safeNext)
          }
        })
      return
    }

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            router.replace('/login?error=auth_failed')
          } else {
            router.replace(safeNext)
          }
        })
      return
    }

    router.replace('/login?error=link_expired')
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-admin-950">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <svg className="animate-spin w-8 h-8 text-admin-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackHandler />
    </Suspense>
  )
}
