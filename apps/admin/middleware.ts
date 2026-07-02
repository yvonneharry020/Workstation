import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_ROUTES    = ['/login', '/forgot-password', '/reset-password']
const PUBLIC_PREFIXES = ['/auth', '/_next', '/favicon', '/unauthorized', '/access-restricted', '/setup-account']

type Permissions = { admin: boolean; management: boolean; technical: boolean; finance: boolean }
type StaffRow    = { is_active: boolean; role: string; permissions: Permissions; full_name: string | null }
type SessionMeta = { id: string; name: string; role: string; department: string | null; permissions: Permissions }

/**
 * Parse the _wk_sessions cookie — a registry of all accounts currently
 * logged in across tabs in this browser.  Written by loginAction server-side,
 * so it can't be forged without a real Supabase auth call.
 */
function parseSessionsCookie(request: NextRequest): Record<string, SessionMeta> {
  const raw = request.cookies.get('_wk_sessions')?.value
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, SessionMeta> } catch { return {} }
}

/**
 * Find the best matching session for a given room from the multi-session registry.
 * This is how we support Finance + Admin open in the same browser simultaneously:
 * each route prefix picks the right account's metadata.
 */
function pickSessionForRoom(
  room: string | null,
  sessions: Record<string, SessionMeta>
): SessionMeta | null {
  const list = Object.values(sessions)
  if (list.length === 0) return null

  if (!room) return list.find(s => s.role === 'superadmin' || s.permissions.admin) ?? list[0]

  if (room === 'admin') {
    return list.find(s => s.role === 'superadmin' || s.role === 'admin' || s.permissions.admin) ?? null
  }
  // For finance / technical / management rooms — prefer a non-superadmin staff match
  const staffMatch = list.find(s =>
    s.role !== 'superadmin' && s.permissions[room as keyof Permissions]
  )
  if (staffMatch) return staffMatch
  // Fall back to superadmin (they have access to everything)
  return list.find(s => s.role === 'superadmin') ?? null
}

const SUPER_ADMIN_EMAIL = 'yvonne2okis@gmail.com'

const SUPER_ADMIN_PERMS: Permissions = {
  admin: true, management: true, technical: true, finance: true,
}

const LEGACY_ROOM_ROLES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: '/finance/', allowed: ['superadmin', 'finance'] },
  { prefix: '/tech/',    allowed: ['superadmin', 'tech'] },
  { prefix: '/ops/',     allowed: ['superadmin', 'ops'] },
]

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
      pathname.startsWith('/attendance')||
      pathname.startsWith('/work-config') ||
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

function setSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

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

  // ── Multi-session fast-path ───────────────────────────────────────────────
  // If _wk_sessions cookie has been populated (by loginAction), use it to
  // serve the correct account's metadata per route — this is what enables
  // multiple accounts to be open in the same browser simultaneously.
  const sessions = parseSessionsCookie(request)
  const hasSessions = Object.keys(sessions).length > 0

  if (hasSessions && user) {
    // When multiple accounts are active, always allow /login to be shown.
    // A second user opening a new tab needs to be able to sign in as themselves
    // even though another account's session already exists in _wk_sessions.
    // The login page itself handles redirecting already-logged-in tabs via sessionStorage.
    if (['/login', '/forgot-password'].some(r => pathname.startsWith(r))) {
      setSecurityHeaders(response)
      return response
    }

    const room = getRoomForPath(pathname)
    const match = pickSessionForRoom(room, sessions)

    if (match) {
      // Permission check: superadmin bypasses all; others need explicit room permission
      if (match.role !== 'superadmin' && match.role !== 'admin' && room) {
        if (!match.permissions[room as keyof Permissions]) {
          return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
      }

      // Stamp the route-appropriate account's metadata
      response.cookies.set('_wk_role',  match.role, COOKIE_OPTS)
      response.cookies.set('_wk_perms', JSON.stringify(match.permissions), COOKIE_OPTS)
      response.cookies.set('_wk_name',  match.name, COOKIE_OPTS)
      setSecurityHeaders(response)
      return response
    }
  }

  // ── No multi-session cookie — fall back to single-session behaviour ────────
  if (!user && !isAuthRoute) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    // Super admin fast-path
    if (user.email === SUPER_ADMIN_EMAIL) {
      if (['/login', '/forgot-password'].some(r => pathname.startsWith(r))) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      const superAdminName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        'Yvonne Harry'
      response.cookies.set('_wk_role',  'superadmin', COOKIE_OPTS)
      response.cookies.set('_wk_perms', JSON.stringify(SUPER_ADMIN_PERMS), COOKIE_OPTS)
      response.cookies.set('_wk_name',  superAdminName, COOKIE_OPTS)
      setSecurityHeaders(response)
      return response
    }

    // Staff / regular admin path
    try {
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

        if (['/login', '/forgot-password'].some(r => pathname.startsWith(r))) {
          return NextResponse.redirect(
            new URL(getPrimaryDest(perms, staffMember.role), request.url)
          )
        }

        if (staffMember.role !== 'admin') {
          const room = getRoomForPath(pathname)
          if (room && !perms[room as keyof Permissions]) {
            return NextResponse.redirect(new URL('/unauthorized', request.url))
          }
        }

        response.cookies.set('_wk_role',  staffMember.role, COOKIE_OPTS)
        response.cookies.set('_wk_perms', JSON.stringify(perms), COOKIE_OPTS)
        response.cookies.set('_wk_name',  staffMember.full_name ?? '', COOKIE_OPTS)
        setSecurityHeaders(response)
        return response
      }

      if (!isAuthRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch {
      // Fail open on DB errors
    }
  }

  setSecurityHeaders(response)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
