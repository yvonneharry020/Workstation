'use client'

import { useState } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface UserProfile {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role: string | null
  user_metadata: Record<string, unknown>
}

interface AuditEntry {
  id: string
  event: string
  created_at: string
  severity: string
  metadata: Record<string, unknown>
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ResultCard({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm text-text-primary mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

export default function UserDoctorPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [candidateData, setCandidateData] = useState<Record<string, unknown> | null>(null)
  const [companyData, setCompanyData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setUser(null)
    setAuditLogs([])
    setCandidateData(null)
    setCompanyData(null)
    setError(null)
    setActionMsg(null)

    const isUUID = /^[0-9a-f-]{36}$/i.test(q)

    const [{ data: candidateRows }, { data: companyRows }] = await Promise.all([
      supabase.from('candidates').select('id,user_id,full_name,email,verification_status,trust_score').or(isUUID ? `user_id.eq.${q},id.eq.${q}` : `email.eq.${q}`).limit(1),
      supabase.from('companies').select('id,user_id,name,email,verification_status').or(isUUID ? `user_id.eq.${q},id.eq.${q}` : `email.eq.${q}`).limit(1),
    ])

    const candidate = candidateRows?.[0] as Record<string, unknown> | null
    const company = companyRows?.[0] as Record<string, unknown> | null
    setCandidateData(candidate ?? null)
    setCompanyData(company ?? null)

    const userId = (candidate?.user_id ?? company?.user_id ?? (isUUID ? q : null)) as string | null
    const email = (candidate?.email ?? company?.email ?? (!isUUID ? q : null)) as string | null

    if (!userId && !email) {
      setError('User not found — try a different email or UUID.')
      setLoading(false)
      return
    }

    const logFilter = userId
      ? supabase.from('audit_logs').select('id,event,created_at,severity,metadata').eq('actor_id', userId).order('created_at', { ascending: false }).limit(10)
      : supabase.from('audit_logs').select('id,event,created_at,severity,metadata').eq('actor_email', email!).order('created_at', { ascending: false }).limit(10)

    const { data: logs } = await logFilter
    setAuditLogs((logs ?? []) as AuditEntry[])

    if (userId || email) {
      setUser({
        id: userId ?? 'unknown',
        email: email ?? 'unknown',
        created_at: (candidate?.created_at ?? company?.created_at ?? '') as string,
        last_sign_in_at: null,
        role: candidate ? 'candidate' : company ? 'company' : 'unknown',
        user_metadata: {},
      })
    }

    setLoading(false)
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    const { error: e } = await supabase.auth.resetPasswordForEmail(user.email)
    setActionMsg(e ? `Failed: ${e.message}` : `Password reset email sent to ${user.email}`)
  }

  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'text-red-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">User Doctor</h1>
        <p className="text-sm text-text-secondary mt-0.5">Diagnose user accounts by email or UUID. View auth status, profile data, and activity history.</p>
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-6">
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Search User</p>
          <div className="flex gap-3">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSearch()}
              placeholder="email@example.com or UUID"
              className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-tech-500 transition-colors font-mono"
            />
            <button onClick={handleSearch} disabled={loading} className="px-5 py-2.5 bg-tech-500 hover:bg-tech-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40">
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>

        {user && (
          <>
            <div className="bg-surface-card border border-tech-800/30 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-tech-900/50 flex items-center justify-center">
                      <span className="text-tech-300 text-sm font-bold">{user.email[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{user.email}</p>
                      <span className="text-[10px] font-bold text-tech-400 uppercase tracking-wider">{user.role}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePasswordReset} className="px-3 py-1.5 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
                    Send Password Reset
                  </button>
                </div>
              </div>
              {actionMsg && <p className={`text-xs mb-3 ${actionMsg.startsWith('Failed') ? 'text-red-400' : 'text-green-400'}`}>{actionMsg}</p>}
              <div className="grid grid-cols-2 gap-4">
                <ResultCard label="User ID" value={user.id} />
                <ResultCard label="Email" value={user.email} />
                <ResultCard label="Role" value={user.role} />
                <ResultCard label="Account Created" value={formatDate(user.created_at)} />
              </div>
            </div>

            {(candidateData ?? companyData) && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Profile Data</p>
                <div className="grid grid-cols-3 gap-4">
                  {candidateData && (
                    <>
                      <ResultCard label="Full Name" value={candidateData.full_name as string} />
                      <ResultCard label="Verification" value={candidateData.verification_status as string} />
                      <ResultCard label="Trust Score" value={candidateData.trust_score as string} />
                    </>
                  )}
                  {companyData && (
                    <>
                      <ResultCard label="Company Name" value={companyData.name as string} />
                      <ResultCard label="Verification" value={companyData.verification_status as string} />
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Last 10 Audit Events</p>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-text-muted">No audit events found for this user.</p>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {auditLogs.map(log => (
                    <li key={log.id} className="py-2.5 flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase w-16 flex-shrink-0 ${SEVERITY_COLORS[log.severity] ?? 'text-text-muted'}`}>{log.severity}</span>
                      <span className="text-sm text-text-primary flex-1 font-mono text-xs">{log.event}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">{formatDate(log.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
