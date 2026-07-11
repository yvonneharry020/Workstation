'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

// ─── Types ───────────────────────────────────────────────────────────────────

type VerifStatus = 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_resubmission'
type MainTab = 'candidates' | 'companies'
type CompanyFilterTab = 'ready' | 'in_progress' | 'verified'
type CandFilterTab = 'all' | 'pending' | 'under_review' | 'verified'

interface CandidateVerif {
  id: string
  first_name: string
  last_name: string
  email: string
  nin_verified: boolean
  phone_verified: boolean
  liveness_verified: boolean
  created_at: string
}

interface CompanyVerif {
  id: string
  company_name: string
  email: string
  industry: string | null
  is_verified: boolean
  created_at: string
  logo_url: string | null
  verification: {
    overall_status: VerifStatus
    cac_status: VerifStatus
    director_nin_status: VerifStatus
    domain_status: VerifStatus
    documents_status: VerifStatus
    manual_review_status: VerifStatus
  } | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Steps verified by third-party APIs (Dojah / Smile Identity).
// Admin does NOT control these — they are read-only in the admin view.
const THIRD_PARTY_STEPS: { key: keyof NonNullable<CompanyVerif['verification']>; label: string; provider: string }[] = [
  { key: 'cac_status',          label: 'CAC Registration',      provider: 'Dojah' },
  { key: 'director_nin_status', label: 'Director NIN',          provider: 'Smile Identity' },
  { key: 'domain_status',       label: 'Business Email Domain', provider: 'Automated' },
  { key: 'documents_status',    label: 'Business Documents',    provider: 'Automated' },
]

const REQUIRED_KEYS = THIRD_PARTY_STEPS.map(s => s.key)

function allStepsPassed(v: CompanyVerif['verification']): boolean {
  if (!v) return false
  return REQUIRED_KEYS.every(k => v[k] === 'approved')
}

function stepsApproved(v: CompanyVerif['verification']): number {
  if (!v) return 0
  return REQUIRED_KEYS.filter(k => v[k] === 'approved').length
}

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCandVerif(c: CandidateVerif) {
  if (c.nin_verified && c.phone_verified && c.liveness_verified) return 'verified'
  if (c.nin_verified || c.phone_verified || c.liveness_verified) return 'under_review'
  return 'pending'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ value }: { value: string }) {
  const styles: Record<string, { color: string; bg: string }> = {
    verified:     { color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
    pending:      { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)'  },
    under_review: { color: '#38BDF8', bg: 'rgba(56,189,248,0.1)'  },
    approved:     { color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
    rejected:     { color: '#F87171', bg: 'rgba(239,68,68,0.1)'   },
    not_started:  { color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    in_review:    { color: '#38BDF8', bg: 'rgba(56,189,248,0.1)'  },
  }
  const s = styles[value] ?? styles['not_started']
  return (
    <span style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function VerifBadges({ nin, phone, liveness }: { nin: boolean; phone: boolean; liveness: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[{ label: 'NIN', active: nin }, { label: 'Phone', active: phone }, { label: 'Face', active: liveness }].map(c => (
        <span key={c.label} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, backgroundColor: c.active ? 'rgba(52,211,153,0.1)' : 'var(--bg-elevated)', color: c.active ? '#34D399' : 'var(--tx-3)', border: `1px solid ${c.active ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`, fontWeight: 600 }}>{c.label}</span>
      ))}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function VerificationsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mainTab, setMainTab] = useState<MainTab>('companies')
  const [companyFilter, setCompanyFilter] = useState<CompanyFilterTab>('ready')
  const [candFilter, setCandFilter] = useState<CandFilterTab>('pending')
  const [candidates, setCandidates] = useState<CandidateVerif[]>([])
  const [companies, setCompanies] = useState<CompanyVerif[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: candProfiles },
      { data: compProfiles },
      { data: compVerifs },
      { data: candAccounts },
      { data: compAccounts },
    ] = await Promise.all([
      supabase.from('candidate_profiles').select('id, first_name, last_name, nin_verified, phone_verified, liveness_verified, created_at'),
      supabase.from('company_profiles').select('id, company_name, industry, is_verified, created_at, logo_url'),
      supabase.from('company_verification').select('company_id, overall_status, cac_status, director_nin_status, domain_status, documents_status, manual_review_status'),
      supabase.from('profiles').select('id, email').eq('role', 'candidate'),
      supabase.from('profiles').select('id, email').eq('role', 'company'),
    ])

    const candEmailMap = new Map((candAccounts ?? []).map(p => [p.id as string, p.email as string]))
    const compEmailMap = new Map((compAccounts ?? []).map(p => [p.id as string, p.email as string]))
    const verifMap = new Map((compVerifs ?? []).map(v => [v.company_id as string, v]))

    setCandidates((candProfiles ?? []).map(cp => ({
      id: cp.id, first_name: cp.first_name, last_name: cp.last_name,
      email: candEmailMap.get(cp.id) ?? '—',
      nin_verified: cp.nin_verified, phone_verified: cp.phone_verified, liveness_verified: cp.liveness_verified,
      created_at: cp.created_at,
    })))

    setCompanies((compProfiles ?? []).map(cp => {
      const v = verifMap.get(cp.id)
      return {
        id: cp.id, company_name: cp.company_name,
        email: compEmailMap.get(cp.id) ?? '—',
        industry: cp.industry ?? null,
        is_verified: cp.is_verified ?? false,
        created_at: cp.created_at,
        logo_url: (cp as { logo_url?: string | null }).logo_url ?? null,
        verification: v ? {
          overall_status: v.overall_status as VerifStatus,
          cac_status: v.cac_status as VerifStatus,
          director_nin_status: v.director_nin_status as VerifStatus,
          domain_status: v.domain_status as VerifStatus,
          documents_status: v.documents_status as VerifStatus,
          manual_review_status: v.manual_review_status as VerifStatus,
        } : null,
      }
    }))

    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  // Candidate actions (unchanged — admin still manually approves candidate verif)
  async function approveCand(id: string) {
    setActing(id)
    await supabase.from('candidate_profiles').update({ nin_verified: true, phone_verified: true, liveness_verified: true }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({ event: 'admin.candidate_verification_approved', actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: id, target_type: 'candidate', severity: 'info', app: 'admin_panel' })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, nin_verified: true, phone_verified: true, liveness_verified: true } : c))
    setActing(null)
  }

  async function clearCand(id: string) {
    setActing(id)
    await supabase.from('candidate_profiles').update({ nin_verified: false, phone_verified: false, liveness_verified: false }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({ event: 'admin.candidate_verification_cleared', actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: id, target_type: 'candidate', severity: 'info', app: 'admin_panel' })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, nin_verified: false, phone_verified: false, liveness_verified: false } : c))
    setActing(null)
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const readyCompanies   = companies.filter(c => !c.is_verified && allStepsPassed(c.verification))
  const progressCompanies = companies.filter(c => !c.is_verified && !allStepsPassed(c.verification))
  const verifiedCompanies = companies.filter(c => c.is_verified)

  const pendingCands = candidates.filter(c => getCandVerif(c) === 'pending').length

  const filteredCompanies = companyFilter === 'ready'       ? readyCompanies
    : companyFilter === 'in_progress' ? progressCompanies
    : verifiedCompanies

  const filteredCandidates = candFilter === 'all' ? candidates
    : candidates.filter(c => getCandVerif(c) === candFilter)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        title="Verification Queue"
        subtitle={`${readyCompanies.length} ${readyCompanies.length === 1 ? 'company' : 'companies'} ready for badge · ${pendingCands} candidates pending`}
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['companies', 'candidates'] as MainTab[]).map(t => (
            <button key={t} onClick={() => setMainTab(t)} style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', backgroundColor: mainTab === t ? '#6366F1' : 'var(--bg-elevated)', color: mainTab === t ? '#fff' : 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {t === 'companies' ? 'Companies' : 'Candidates'}
              {t === 'companies' && readyCompanies.length > 0 && (
                <span style={{ backgroundColor: '#EF4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{readyCompanies.length}</span>
              )}
              {t === 'candidates' && (
                <span style={{ backgroundColor: mainTab === t ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{candidates.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Companies view ── */}
        {mainTab === 'companies' && (
          <>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { key: 'ready' as CompanyFilterTab,       label: 'Ready for Badge',  count: readyCompanies.length,    alert: true },
                { key: 'in_progress' as CompanyFilterTab, label: 'In Progress',      count: progressCompanies.length, alert: false },
                { key: 'verified' as CompanyFilterTab,    label: 'Verified',         count: verifiedCompanies.length, alert: false },
              ]).map(t => (
                <button key={t.key} onClick={() => setCompanyFilter(t.key)} style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s', backgroundColor: companyFilter === t.key ? '#6366F1' : 'var(--bg-elevated)', color: companyFilter === t.key ? '#fff' : 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.label}
                  <span style={{ backgroundColor: t.alert && t.count > 0 ? '#EF4444' : companyFilter === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', color: t.alert && t.count > 0 ? '#fff' : 'inherit', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: t.alert && t.count > 0 ? 700 : 400 }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Alert banner when companies are ready */}
            {companyFilter === 'ready' && readyCompanies.length > 0 && (
              <div style={{ backgroundColor: 'rgba(29,155,240,0.08)', border: '1px solid rgba(29,155,240,0.25)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>🔔</span>
                <div>
                  <p style={{ color: '#1D9BF0', fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {readyCompanies.length} {readyCompanies.length === 1 ? 'company has' : 'companies have'} completed all verification steps
                  </p>
                  <p style={{ color: 'var(--tx-3)', fontSize: 12, margin: 0 }}>
                    Click any card to review and grant the verified badge
                  </p>
                </div>
              </div>
            )}

            {/* Company cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ ...CARD_STYLE, padding: '20px 24px', height: 80 }}>
                  <div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '40%' }} />
                </div>
              ))}

              {!loading && filteredCompanies.length === 0 && (
                <div style={{ ...CARD_STYLE, padding: '48px 24px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                  {companyFilter === 'ready' ? 'No companies have completed all verification steps yet.' : companyFilter === 'in_progress' ? 'No companies currently going through verification.' : 'No companies have been verified yet.'}
                </div>
              )}

              {!loading && filteredCompanies.map(c => {
                const done = stepsApproved(c.verification)
                const total = REQUIRED_KEYS.length
                const isReady = allStepsPassed(c.verification)

                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/verifications/companies/${c.id}`)}
                    style={{ ...CARD_STYLE, padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s', ...(isReady ? { borderColor: 'rgba(29,155,240,0.4)', boxShadow: '0 0 0 1px rgba(29,155,240,0.2)' } : {}) }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                  >
                    {/* Logo */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: isReady ? 'linear-gradient(135deg, #1D9BF0, #0EA5E9)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {c.logo_url
                        ? <img src={c.logo_url} alt={c.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{c.company_name.slice(0, 2).toUpperCase()}</span>
                      }
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</p>
                        {c.is_verified && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#1D9BF0', backgroundColor: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.3)', borderRadius: 5, padding: '2px 6px' }}>
                            ✓ VERIFIED
                          </span>
                        )}
                        {isReady && !c.is_verified && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#34D399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 5, padding: '2px 6px' }}>
                            ● READY
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}{c.industry ? ` · ${c.industry}` : ''} · Joined {formatDate(c.created_at)}</p>
                    </div>

                    {/* Step chips */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      {THIRD_PARTY_STEPS.map(step => {
                        const status = c.verification?.[step.key] ?? 'not_started'
                        const approved = status === 'approved'
                        return (
                          <span key={step.key} title={step.label} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 600, backgroundColor: approved ? 'rgba(52,211,153,0.12)' : 'var(--bg-elevated)', color: approved ? '#34D399' : 'var(--tx-3)', border: `1px solid ${approved ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
                            {approved ? '✓' : '○'} {step.label.split(' ')[0]}
                          </span>
                        )
                      })}
                    </div>

                    {/* Progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: done === total ? '#34D399' : 'var(--tx-3)' }}>{done}/{total}</span>
                    </div>

                    {/* Arrow */}
                    <span style={{ color: 'var(--tx-3)', fontSize: 14, flexShrink: 0 }}>›</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Candidates view ── */}
        {mainTab === 'candidates' && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { key: 'all' as CandFilterTab,          label: 'All',          count: candidates.length },
                { key: 'pending' as CandFilterTab,      label: 'Pending',      count: candidates.filter(c => getCandVerif(c) === 'pending').length },
                { key: 'under_review' as CandFilterTab, label: 'Under Review', count: candidates.filter(c => getCandVerif(c) === 'under_review').length },
                { key: 'verified' as CandFilterTab,     label: 'Verified',     count: candidates.filter(c => getCandVerif(c) === 'verified').length },
              ]).map(t => (
                <button key={t.key} onClick={() => setCandFilter(t.key)} style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s', backgroundColor: candFilter === t.key ? '#6366F1' : 'var(--bg-elevated)', color: candFilter === t.key ? '#fff' : 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.label}
                  <span style={{ backgroundColor: candFilter === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{t.count}</span>
                </button>
              ))}
            </div>

            <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                    {['Candidate', 'Status', 'Checks', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '60%' }} /></td></tr>
                  ))}
                  {!loading && filteredCandidates.map(c => {
                    const vs = getCandVerif(c)
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '14px 20px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.first_name} {c.last_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                        </td>
                        <td style={{ padding: '14px 20px' }}><StatusPill value={vs} /></td>
                        <td style={{ padding: '14px 20px' }}><VerifBadges nin={c.nin_verified} phone={c.phone_verified} liveness={c.liveness_verified} /></td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {vs !== 'verified' && <button onClick={() => approveCand(c.id)} disabled={acting === c.id} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: acting === c.id ? 0.6 : 1 }}>Approve All</button>}
                            {vs !== 'pending' && <button onClick={() => clearCand(c.id)} disabled={acting === c.id} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: acting === c.id ? 0.6 : 1 }}>Clear</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && filteredCandidates.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No candidates in this category.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
