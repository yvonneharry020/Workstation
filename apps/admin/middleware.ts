import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password']
const PUBLIC_PREFIXES = ['/auth', '/_next', '/favicon', '/unauthorized']

const ROOM_ROLES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: '/finance/', allowed: ['superadmin', 'finance'] },
  { prefix: '/tech/',    allowed: ['superadmin', 'tech'] },
  { prefix: '/ops/',     allowed: ['superadmin', 'ops'] },
]

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

  if (user && (pathname.startsWith('/login') || pathname.startsWith('/forgot-password'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // RBAC: check room-based roles for department routes
  if (user) {
    const roomRule = ROOM_ROLES.find(r => pathname.startsWith(r.prefix))
    if (roomRule) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        const role = profile?.role as string | undefined

        if (role && !roomRule.allowed.includes(role)) {
          return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
        // Fail open: if no profile or DB error, allow access
      } catch {
        // Fail open on any DB error
      }
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
