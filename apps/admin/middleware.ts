import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_ROUTES    = ['/login', '/forgot-password', '/reset-password']
const PUBLIC_PREFIXES = ['/auth', '/_next', '/favicon', '/unauthorized', '/access-restricted', '/setup-account']

const LEGACY_ROOM_ROLES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: '/finance/', allowed: ['superadmin', 'finance'] },
  { prefix: '/tech/',    allowed: ['superadmin', 'tech'] },
  { prefix: '/ops/',     allowed: ['superadmin', 'ops'] },
]

type Permissions = { admin: boolean; management: boolean; technical: boolean; finance: boolean }
type StaffRow    = { is_active: boolean; role: string; permissions: Permissions; full_name: string | null }

function getRoomForPath(pathname: string): string | null {
  if (pathname.startsWith('/ops/'))     return 'management'
  if (pathname.startsWith('/tech/'))    return 'technical'
  if (pathname.startsWith('/finance/')) return 'finance'
  if (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/users')     ||
      pathname.startsWith('/staff')     ||
      pathname.startsWith('/tickets')   ||
      pathname.startsWith('/ticket-overview') ||
      pathname.startsWith('/analytics') ||
      pathname.startsWith('/audit-log') ||
      pathname.startsWith('/admin-inbox') ||
      pathname.startsWith('/staff-comms') ||
      pathname.startsWith('/disputes')  ||
      pathname.startsWith('/flagged')   ||
      pathname.startsWith('/verifications') ||
      pathname.startsWith('/jobs')      ||
      pathname.startsWith('/notifications') ||
      pathname.startsWith('/compliance') ||
      pathname.startsWith('/knowledge-base') ||
      pathname.startsWith('/tutorials') ||
      pathname.startsWith('/sla-monitor') ||
      pathname.startsWith('/agent-performance') ||
      pathname.startsWith('/search')    ||
      pathname.startsWith('/chat')      ||
      pathname.startsWith('/config')    ||
      pathname.startsWith('/notifications')) {
    return 'admin'
  }
  return null
}

function getPrimaryDest(perms: Permissions, role: string): string {
  if (role === 'admin') return '/dashboard'
  if (perms.admin)      return '/dashboard'
  if (perms.management) return '/ops/dashboard'
  if (perms.technical)  return '/tech/dashboard'
  if (perms.finance)    return '/finance/dashboard'
  return '/dashboard'
}

const COOKIE_OPTS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false,  // must be readable by client JS for UI permission checks
} as const

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  if (!user && !isAuthRoute) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    try {
      // Service role key bypasses RLS — anon key + user JWT is blocked on staff_members
      const staffRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/staff_members` +
        `?email=eq.${encodeURIComponent(user.email ?? '')}` +
        `&select=is_active,role,permissions,full_name&limit=1`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
        }
      )
      const staffRows: StaffRow[] = staffRes.ok ? await staffRes.json() : []
      const staffMember = staffRows[0] ?? null

      if (staffMember) {
        if (!staffMember.is_active) {
          return NextResponse.redirect(new URL('/access-restricted', request.url))
        }

        const perms: Permissions = (staffMember.permissions as Permissions) ?? {
          admin: false, management: false, technical: false, finance: false,
        }

        // Redirect logged-in staff away from login / forgot-password
        // (/reset-password stays accessible — recovery links need it while logged in)
        if (['/login', '/forgot-password'].some(r => pathname.startsWith(r))) {
          return NextResponse.redirect(
            new URL(getPrimaryDest(perms, staffMember.role), request.url)
          )
        }

        // Admin role bypasses all room checks; otherwise verify room access
        if (staffMember.role !== 'admin') {
          const room = getRoomForPath(pathname)
          if (room && !perms[room as keyof Permissions]) {
            return NextResponse.redirect(new URL('/unauthorized', request.url))
          }
        }

        // Stamp permission cookies so client components can read them without a DB round-trip
        response.cookies.set('_wk_role',  staffMember.role, COOKIE_OPTS)
        response.cookies.set('_wk_perms', encodeURIComponent(JSON.stringify(perms)), COOKIE_OPTS)
        response.cookies.set('_wk_name',  encodeURIComponent(staffMember.full_name ?? ''), COOKIE_OPTS)

        response.headers.set('X-Frame-Options', 'DENY')
        response.headers.set('X-Content-Type-Options', 'nosniff')
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.set('X-XSS-Protection', '1; mode=block')
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        return response
      }

      // No staff_members record — fall back to legacy profiles.role check (super admin path)
      const roomRule = LEGACY_ROOM_ROLES.find(r => pathname.startsWith(r.prefix))
      if (roomRule) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        const role = profile?.role as string | undefined
        if (role && !roomRule.allowed.includes(role)) {
          return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
      }
    } catch {
      // Fail open on any DB error — do not lock out users
    }
  }

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
