'use client'

export default function AccessRestrictedPage() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-error">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold font-display text-text-primary mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-8">
          Your access to this platform has been restricted.<br />
          Please contact the admin to resolve this.
        </p>
        <div className="bg-surface-card border border-surface-border rounded-xl px-5 py-4">
          <p className="text-xs text-text-muted">If you believe this is an error, reach out to your administrator and provide your email address.</p>
        </div>
      </div>
    </div>
  )
}
