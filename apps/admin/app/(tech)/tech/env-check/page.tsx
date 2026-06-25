'use client'

import { useState, useEffect } from 'react'

interface EnvCheck {
  key: string
  category: string
  description: string
  isPresent: boolean
  isPublic: boolean
}

const ENV_VARS: Omit<EnvCheck, 'isPresent'>[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', category: 'Supabase', description: 'Supabase project URL', isPublic: true },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', category: 'Supabase', description: 'Supabase anonymous key (public)', isPublic: true },
  { key: 'NEXT_PUBLIC_APP_URL', category: 'App', description: 'Public app base URL', isPublic: true },
  { key: 'PAYSTACK_SECRET_KEY', category: 'Payments', description: 'Paystack secret key (server-only)', isPublic: false },
  { key: 'RESEND_API_KEY', category: 'Email', description: 'Resend API key for transactional email', isPublic: false },
  { key: 'VERCEL_ENV', category: 'Vercel', description: 'Vercel environment (production/preview/development)', isPublic: false },
  { key: 'VERCEL_GIT_COMMIT_SHA', category: 'Vercel', description: 'Current git commit SHA', isPublic: false },
  { key: 'VERCEL_REGION', category: 'Vercel', description: 'Vercel region the function is running in', isPublic: false },
]

const CATEGORIES = [...new Set(ENV_VARS.map(e => e.category))]

export default function EnvCheckPage() {
  const [checks, setChecks] = useState<EnvCheck[]>([])
  const [nodeVersion, setNodeVersion] = useState<string | null>(null)
  const [vercelEnv, setVercelEnv] = useState<string | null>(null)
  const [commitSha, setCommitSha] = useState<string | null>(null)

  useEffect(() => {
    const resolved = ENV_VARS.map(e => ({
      ...e,
      isPresent: e.isPublic
        ? Boolean(process.env[e.key as keyof NodeJS.ProcessEnv])
        : false,
    }))
    setChecks(resolved)
    setVercelEnv(process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? null)
    setCommitSha(process.env.VERCEL_GIT_COMMIT_SHA ?? null)
    setNodeVersion(typeof process !== 'undefined' && process.version ? process.version : null)
  }, [])

  const present = checks.filter(c => c.isPublic && c.isPresent).length
  const publicTotal = checks.filter(c => c.isPublic).length
  const privateCount = checks.filter(c => !c.isPublic).length

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Environment Checker</h1>
        <p className="text-sm text-text-secondary mt-0.5">Validates required environment variables. Private key values are never shown — only presence is checked.</p>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <p className="text-2xl font-bold font-display text-text-primary">{present} / {publicTotal}</p>
            <p className="text-xs text-text-muted mt-0.5">Public vars present</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className={`text-2xl font-bold font-display ${vercelEnv === 'production' ? 'text-orange-400' : vercelEnv ? 'text-blue-400' : 'text-text-muted'}`}>{vercelEnv ?? 'local'}</div>
            <p className="text-xs text-text-muted mt-0.5">VERCEL_ENV</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <p className="text-2xl font-bold font-display text-text-primary font-mono text-lg">{commitSha ? commitSha.slice(0, 7) : 'n/a'}</p>
            <p className="text-xs text-text-muted mt-0.5">Git commit SHA</p>
          </div>
        </div>

        <div className="bg-yellow-900/10 border border-yellow-800/20 rounded-xl p-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" className="flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-xs text-yellow-300">Private variables ({privateCount}) are server-side only. This page can only verify that public <code className="font-mono">NEXT_PUBLIC_*</code> vars are present — never their values. For server-side checks, inspect Vercel project settings directly.</p>
        </div>

        {CATEGORIES.map(cat => {
          const catVars = checks.filter(c => c.category === cat)
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">{cat}</p>
              <div className="space-y-2">
                {catVars.map(check => (
                  <div key={check.key} className={`flex items-start justify-between px-4 py-3 rounded-xl border ${check.isPublic ? (check.isPresent ? 'bg-green-900/10 border-green-800/20' : 'bg-red-900/10 border-red-800/20') : 'bg-surface-card border-surface-border'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-text-primary">{check.key}</p>
                        {!check.isPublic && <span className="text-[10px] text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border">server-only</span>}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">{check.description}</p>
                    </div>
                    {check.isPublic ? (
                      <span className={`text-[10px] font-bold flex-shrink-0 mt-0.5 ${check.isPresent ? 'text-green-400' : 'text-red-400'}`}>
                        {check.isPresent ? '✓ SET' : '✗ MISSING'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">NOT CHECKED</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
