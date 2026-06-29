'use client'
import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', marginBottom: 10 }}>Access Denied</h1>
        <p style={{ fontSize: 14, color: 'var(--tx-3)', lineHeight: 1.7, marginBottom: 28 }}>
          You don&apos;t have permission to access this section of the admin panel.
          This area is restricted to users with the appropriate room-level role.
          Contact your system administrator if you need access.
        </p>
        <Link href="/login"
          style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, backgroundColor: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Back to Login
        </Link>
      </div>
    </div>
  )
}
