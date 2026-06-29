import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password']
const PUBLIC_PREFIXES = ['/auth', '/_next', '/favicon', '/unauthorized', '/access-restricted', '/setup-account']

const LEGACY_ROOM_ROLES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: '/finance/', allowed: ['superadmin', 'finance'] },
  { prefix: '/tech/',    allowed: ['superadmin', 'tech'] },
  { prefix: '/ops/',     allowed: ['superadmin', 'ops'] },
]

function getRoomForPath(pathname: string): string | null {
  if (pathname.startsWith('/ops/'))     return 'management'
  if (pathname.startsWith('/tech/'))    return 'technical'
  if (pathname.startsWith('/finance/')) return 'finance'
  // All admin-side routes (staff, users, disputes, etc.) map to admin room
  if (!pathname.startsWith('/ops/') && !pathname.startsWith('/tech/') && !pathname.startsWith('/finance/')) {
    return 'admin'
  }
  return null
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

  if (!user && !isAuthRoute) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    try {
      // Check staff_members table first (new room-based permission system)
      const { data: staffMember } = await supabase
        .from('staff_members')
        .select('is_active, role, permissions')
        .eq('email', user.email)
        .maybeSingle()

      if (staffMember) {
        // Staff member found — enforce room-based access
        if (!staffMember.is_active) {
          return NextResponse.redirect(new URL('/access-restricted', request.url))
        }

        // Redirect logged-in staff away from auth pages to their correct room
        if (AUTH_ROUTES.some(r => pathname.startsWith(r))) {
          let dest = '/dashboard'
          if (staffMember.role !== 'admin') {
            const perms = (staffMember.permissions as Record<string, boolean>) ?? {}
            if (perms.management) dest = '/ops/dashboard'
            else if (perms.technical) dest = '/tech/dashboard'
            else if (perms.finance) dest = '/finance/dashboard'
          }
          return NextResponse.redirect(new URL(dest, request.url))
        }

        // Admin role bypasses all room checks
        if (staffMember.role !== 'admin') {
          const room = getRoomForPath(pathname)
          if (room) {
            const perms = (staffMember.permissions as Record<string, boolean>) ?? {}
            if (!perms[room]) {
              return NextResponse.redirect(new URL('/unauthorized', request.url))
            }
          }
        }

        // Passed staff checks — skip legacy role check
        response.headers.set('X-Frame-Options', 'DENY')
        response.headers.set('X-Content-Type-Options', 'nosniff')
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.set('X-XSS-Protection', '1; mode=block')
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        return response
      }

      // No staff_members record — fall back to legacy profiles.role check
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
