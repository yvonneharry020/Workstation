'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

// ─── Types ───────────────────────────────────────────────────────────────────

type VerifStatus = 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_resubmission'
type MainTab = 'candidates' | 'companies'
type FilterTab = 'all' | 'pending' | 'under_review' | 'verified'

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

interface CompanyVerification {
  overall_status: VerifStatus
  cac_status: VerifStatus
  director_nin_status: VerifStatus
  domain_status: VerifStatus
  documents_status: VerifStatus
  manual_review_status: VerifStatus
}

interface CompanyVerif {
  id: string
  company_name: string
  email: string
  industry: string | null
  website_url: string | null
  is_verified: boolean
  cac_verified: boolean
  director_nin_verified: boolean
  created_at: string
  logo_url: string | null
  verification: CompanyVerification | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const STATUS_META: Record<VerifStatus, { label: string; color: string; bg: string }> = {
  not_started:           { label: 'Not started',    color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
  pending:               { label: 'Pending',         color: '#FBBF24', bg: 'rgba(251,191,36,0.1)'  },
  in_review:             { label: 'In review',       color: '#38BDF8', bg: 'rgba(56,189,248,0.1)'  },
  approved:              { label: 'Approved',        color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
  rejected:              { label: 'Rejected',        color: '#F87171', bg: 'rgba(239,68,68,0.1)'   },
  requires_resubmission: { label: 'Action needed',  color: '#FB923C', bg: 'rgba(251,146,60,0.1)'  },
}

const VERIF_STEPS: { key: keyof CompanyVerification; label: string; hint: string }[] = [
  { key: 'cac_status',           label: 'CAC Registration',      hint: 'Business registered with Corporate Affairs Commission' },
  { key: 'director_nin_status',  label: 'Director NIN',          hint: "Director's identity verified via NIN" },
  { key: 'domain_status',        label: 'Business Email Domain', hint: 'Company email domain ownership confirmed' },
  { key: 'documents_status',     label: 'Business Documents',    hint: 'Uploaded business docs reviewed and accepted' },
  { key: 'manual_review_status', label: 'Manual Review',         hint: 'Final sign-off by admin team' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCandVerif(c: CandidateVerif): 'pending' | 'under_review' | 'verified' {
  if (c.nin_verified && c.phone_verified && c.liveness_verified) return 'verified'
  if (c.nin_verified || c.phone_verified || c.liveness_verified) return 'under_review'
  return 'pending'
}

function approvedSteps(v: CompanyVerification | null): number {
  if (!v) return 0
  return VERIF_STEPS.filter(s => v[s.key] === 'approved').length
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ value }: { value: string }) {
  const s = value === 'verified' ? STATUS_META.approved
    : value === 'pending'       ? STATUS_META.pending
    : value === 'under_review'  ? STATUS_META.in_review
    : STATUS_META[value as VerifStatus] ?? STATUS_META.not_started
  return (
    <span style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function VerifBadges({ nin, phone, liveness }: { nin: boolean; phone: boolean; liveness: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[{ label: 'NIN', active: nin }, { label: 'Phone', active: phone }, { label: 'Face', active: liveness }].map(c => (
        <span key={c.label} style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 99,
          backgroundColor: c.active ? 'rgba(52,211,153,0.1)' : 'var(--bg-elevated)',
          color: c.active ? '#34D399' : 'var(--tx-3)',
          border: `1px solid ${c.active ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
          fontWeight: 600,
        }}>{c.label}</span>
      ))}
    </div>
  )
}

function StepStatusChip({ status }: { status: VerifStatus }) {
  const m = STATUS_META[status]
  return (
    <span style={{ color: m.color, backgroundColor: m.bg, border: `1px solid ${m.color}40`, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const color = pct === 100 ? '#34D399' : pct >= 60 ? '#FBBF24' : '#F87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{done}/{total}</span>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function VerificationsPage() {
  const supabase = createClient()
  const [mainTab, setMainTab] = useState<MainTab>('candidates')
  const [filterTab, setFilterTab] = useState<FilterTab>('pending')
  const [candidates, setCandidates] = useState<CandidateVerif[]>([])
  const [companies, setCompanies] = useState<CompanyVerif[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: candProfiles },
      { data: compProfiles },
      { data: compVerifications },
      { data: candAccounts },
      { data: compAccounts },
    ] = await Promise.all([
      supabase.from('candidate_profiles').select('id, first_name, last_name, nin_verified, phone_verified, liveness_verified, created_at'),
      supabase.from('company_profiles').select('id, company_name, industry, website_url, is_verified, cac_verified, director_nin_verified, created_at, logo_url'),
      supabase.from('company_verification').select('company_id, overall_status, cac_status, director_nin_status, domain_status, documents_status, manual_review_status'),
      supabase.from('profiles').select('id, email').eq('role', 'candidate'),
      supabase.from('profiles').select('id, email').eq('role', 'company'),
    ])

    const candEmailMap = new Map((candAccounts ?? []).map(p => [p.id as string, p.email as string]))
    const compEmailMap = new Map((compAccounts ?? []).map(p => [p.id as string, p.email as string]))
    const verifMap = new Map((compVerifications ?? []).map(v => [v.company_id as string, v as CompanyVerification & { company_id: string }]))

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
        industry: cp.industry, website_url: cp.website_url,
        is_verified: cp.is_verified,
        cac_verified: (cp as { cac_verified?: boolean }).cac_verified ?? false,
        director_nin_verified: (cp as { director_nin_verified?: boolean }).director_nin_verified ?? false,
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

  // ── Candidate actions ─────────────────────────────────────────────────────

  async function approveCand(id: string) {
    setActing(id)
    await supabase.from('candidate_profiles').update({ nin_verified: true, phone_verified: true, liveness_verified: true }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.candidate_verification_approved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'candidate', severity: 'info', app: 'admin_panel',
    })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, nin_verified: true, phone_verified: true, liveness_verified: true } : c))
    setActing(null)
  }

  async function clearCand(id: string) {
    setActing(id)
    await supabase.from('candidate_profiles').update({ nin_verified: false, phone_verified: false, liveness_verified: false }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.candidate_verification_cleared', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'candidate', severity: 'info', app: 'admin_panel',
    })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, nin_verified: false, phone_verified: false, liveness_verified: false } : c))
    setActing(null)
  }

  // ── Company step actions ──────────────────────────────────────────────────

  async function updateStep(companyId: string, stepKey: keyof CompanyVerification, newStatus: VerifStatus) {
    setActing(`${companyId}-${stepKey}`)
    const { data: { user } } = await supabase.auth.getUser()

    const existing = companies.find(c => c.id === companyId)?.verification
    if (existing) {
      await supabase.from('company_verification')
        .update({ [stepKey]: newStatus, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
    } else {
      const defaults: CompanyVerification = {
        overall_status: 'pending', cac_status: 'not_started', director_nin_status: 'not_started',
        domain_status: 'not_started', documents_status: 'not_started', manual_review_status: 'not_started',
      }
      await supabase.from('company_verification').insert({
        company_id: companyId, ...defaults, [stepKey]: newStatus,
      })
    }

    await supabase.from('audit_logs').insert({
      event: `admin.company_step_${newStatus}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: companyId, target_type: 'company',
      metadata: { step: stepKey, status: newStatus },
      severity: 'info', app: 'admin_panel',
    })

    setCompanies(prev => prev.map(c => {
      if (c.id !== companyId) return c
      const base: CompanyVerification = c.verification ?? {
        overall_status: 'pending', cac_status: 'not_started', director_nin_status: 'not_started',
        domain_status: 'not_started', documents_status: 'not_started', manual_review_status: 'not_started',
      }
      return { ...c, verification: { ...base, [stepKey]: newStatus } }
    }))
    setActing(null)
  }

  // ── Grant / revoke badge ──────────────────────────────────────────────────

  async function grantBadge(id: string) {
    setActing(`${id}-badge`)
    const { data: { user } } = await supabase.auth.getUser()

    await Promise.all([
      supabase.from('company_profiles').update({ is_verified: true }).eq('id', id),
      supabase.from('company_verification')
        .update({ overall_status: 'approved', manual_review_status: 'approved', updated_at: new Date().toISOString() })
        .eq('company_id', id),
    ])

    await supabase.from('audit_logs').insert({
      event: 'admin.company_verified_badge_granted', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'company', severity: 'high', app: 'admin_panel',
    })

    setCompanies(prev => prev.map(c => {
      if (c.id !== id) return c
      const base: CompanyVerification = c.verification ?? {
        overall_status: 'approved', cac_status: 'not_started', director_nin_status: 'not_started',
        domain_status: 'not_started', documents_status: 'not_started', manual_review_status: 'not_started',
      }
      return { ...c, is_verified: true, verification: { ...base, overall_status: 'approved', manual_review_status: 'approved' } }
    }))
    setActing(null)
  }

  async function revokeBadge(id: string) {
    setActing(`${id}-badge`)
    const { data: { user } } = await supabase.auth.getUser()

    await Promise.all([
      supabase.from('company_profiles').update({ is_verified: false }).eq('id', id),
      supabase.from('company_verification')
        .update({ overall_status: 'rejected', manual_review_status: 'in_review', updated_at: new Date().toISOString() })
        .eq('company_id', id),
    ])

    await supabase.from('audit_logs').insert({
      event: 'admin.company_verified_badge_revoked', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'company', severity: 'high', app: 'admin_panel',
    })

    setCompanies(prev => prev.map(c => {
      if (c.id !== id) return c
      const base = c.verification
      return { ...c, is_verified: false, verification: base ? { ...base, overall_status: 'rejected', manual_review_status: 'in_review' } : null }
    }))
    setActing(null)
  }

  // ── Filter logic ──────────────────────────────────────────────────────────

  const pendingCands = candidates.filter(c => getCandVerif(c) === 'pending').length
  const pendingComps = companies.filter(c => !c.is_verified).length

  const filteredCandidates = candidates.filter(c => {
    if (filterTab === 'all') return true
    return getCandVerif(c) === filterTab
  })

  const filteredCompanies = companies.filter(c => {
    if (filterTab === 'all') return true
    if (filterTab === 'verified') return c.is_verified
    if (filterTab === 'pending') return !c.is_verified
    return false
  })

  const CAND_TABS = [
    { key: 'all' as FilterTab, label: 'All', count: candidates.length },
    { key: 'pending' as FilterTab, label: 'Pending', count: candidates.filter(c => getCandVerif(c) === 'pending').length },
    { key: 'under_review' as FilterTab, label: 'Under Review', count: candidates.filter(c => getCandVerif(c) === 'under_review').length },
    { key: 'verified' as FilterTab, label: 'Verified', count: candidates.filter(c => getCandVerif(c) === 'verified').length },
  ]

  const COMP_TABS = [
    { key: 'all' as FilterTab, label: 'All', count: companies.length },
    { key: 'pending' as FilterTab, label: 'Needs Review', count: companies.filter(c => !c.is_verified).length },
    { key: 'verified' as FilterTab, label: 'Verified', count: companies.filter(c => c.is_verified).length },
  ]

  const filterTabs = mainTab === 'candidates' ? CAND_TABS : COMP_TABS

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        title="Verification Queue"
        subtitle={`${pendingCands} candidates pending · ${pendingComps} companies awaiting badge`}
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['candidates', 'companies'] as MainTab[]).map(t => (
            <button key={t} onClick={() => { setMainTab(t); setFilterTab('pending') }} style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', transition: 'all 0.15s',
              backgroundColor: mainTab === t ? '#6366F1' : 'var(--bg-elevated)',
              color: mainTab === t ? '#fff' : 'var(--tx-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t === 'candidates' ? 'Candidates' : 'Companies'}
              <span style={{ backgroundColor: mainTab === t ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>
                {t === 'candidates' ? candidates.length : companies.length}
              </span>
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilterTab(t.key)} style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', transition: 'all 0.15s',
              backgroundColor: filterTab === t.key ? '#6366F1' : 'var(--bg-elevated)',
              color: filterTab === t.key ? '#fff' : 'var(--tx-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t.label}
              <span style={{ backgroundColor: filterTab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── Candidates table ── */}
        {mainTab === 'candidates' && (
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Candidate', 'Verification Status', 'Checks', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '60%' }} /></td></tr>
                ))}
                {!loading && filteredCandidates.map(c => {
                  const verifStatus = getCandVerif(c)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ padding: '14px 20px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.first_name} {c.last_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                      </td>
                      <td style={{ padding: '14px 20px' }}><StatusPill value={verifStatus} /></td>
                      <td style={{ padding: '14px 20px' }}><VerifBadges nin={c.nin_verified} phone={c.phone_verified} liveness={c.liveness_verified} /></td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {verifStatus !== 'verified' && (
                            <button onClick={() => approveCand(c.id)} disabled={acting === c.id}
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: acting === c.id ? 0.6 : 1 }}>
                              Approve All
                            </button>
                          )}
                          {verifStatus !== 'pending' && (
                            <button onClick={() => clearCand(c.id)} disabled={acting === c.id}
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: acting === c.id ? 0.6 : 1 }}>
                              Clear
                            </button>
                          )}
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
        )}

        {/* ── Companies — expandable checklist rows ── */}
        {mainTab === 'companies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...CARD_STYLE, padding: '20px 24px', height: 72 }}>
                <div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '40%' }} />
              </div>
            ))}

            {!loading && filteredCompanies.length === 0 && (
              <div style={{ ...CARD_STYLE, padding: '48px 24px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                No companies in this category.
              </div>
            )}

            {!loading && filteredCompanies.map(c => {
              const done = approvedSteps(c.verification)
              const total = VERIF_STEPS.length
              const isExpanded = expanded === c.id
              const isBadgeActing = acting === `${c.id}-badge`
              const allApproved = done === total

              return (
                <div key={c.id} style={{ ...CARD_STYLE, overflow: 'hidden' }}>

                  {/* ── Company summary row ── */}
                  <div
                    onClick={() => setExpanded(isExpanded ? null : c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Logo */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {c.logo_url
                        ? <img src={c.logo_url} alt={c.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{c.company_name.slice(0, 2).toUpperCase()}</span>
                      }
                    </div>

                    {/* Name + email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</p>
                        {c.is_verified && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#1D9BF0', backgroundColor: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                            ✓ VERIFIED
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email} {c.industry ? `· ${c.industry}` : ''}</p>
                    </div>

                    {/* Progress */}
                    <div style={{ width: 140, flexShrink: 0 }}>
                      <p style={{ fontSize: 10, color: 'var(--tx-3)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Steps approved</p>
                      <ProgressBar done={done} total={total} />
                    </div>

                    {/* Joined */}
                    <p style={{ fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap', margin: 0, flexShrink: 0 }}>{formatDate(c.created_at)}</p>

                    {/* Expand chevron */}
                    <span style={{ color: 'var(--tx-3)', fontSize: 14, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
                  </div>

                  {/* ── Expanded checklist panel ── */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', backgroundColor: 'var(--bg-surface)' }}>

                      {/* CAC & NIN from company_profiles (auto-set by onboarding) */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: c.cac_verified ? '#34D399' : '#64748B', backgroundColor: c.cac_verified ? 'rgba(52,211,153,0.1)' : 'var(--bg-elevated)', border: `1px solid ${c.cac_verified ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '3px 8px' }}>
                          {c.cac_verified ? '✓ CAC submitted' : '○ CAC not submitted'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: c.director_nin_verified ? '#34D399' : '#64748B', backgroundColor: c.director_nin_verified ? 'rgba(52,211,153,0.1)' : 'var(--bg-elevated)', border: `1px solid ${c.director_nin_verified ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '3px 8px' }}>
                          {c.director_nin_verified ? '✓ Director NIN submitted' : '○ Director NIN not submitted'}
                        </span>
                      </div>

                      {/* Verification steps */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {VERIF_STEPS.map(step => {
                          const status: VerifStatus = c.verification?.[step.key] ?? 'not_started'
                          const isStepActing = acting === `${c.id}-${step.key}`
                          return (
                            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{step.label}</p>
                                <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{step.hint}</p>
                              </div>
                              <StepStatusChip status={status} />
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                {status !== 'approved' && (
                                  <button
                                    onClick={() => updateStep(c.id, step.key, 'approved')}
                                    disabled={isStepActing}
                                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: isStepActing ? 0.5 : 1 }}>
                                    Approve
                                  </button>
                                )}
                                {status !== 'in_review' && status !== 'approved' && (
                                  <button
                                    onClick={() => updateStep(c.id, step.key, 'in_review')}
                                    disabled={isStepActing}
                                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38BDF8', opacity: isStepActing ? 0.5 : 1 }}>
                                    In Review
                                  </button>
                                )}
                                {status !== 'rejected' && (
                                  <button
                                    onClick={() => updateStep(c.id, step.key, 'rejected')}
                                    disabled={isStepActing}
                                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: isStepActing ? 0.5 : 1 }}>
                                    Reject
                                  </button>
                                )}
                                {status === 'approved' && (
                                  <button
                                    onClick={() => updateStep(c.id, step.key, 'in_review')}
                                    disabled={isStepActing}
                                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)', opacity: isStepActing ? 0.5 : 1 }}>
                                    Undo
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Badge grant / revoke */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 2px' }}>
                            Verified Badge {c.is_verified ? '— currently active' : '— not yet granted'}
                          </p>
                          {!allApproved && !c.is_verified && (
                            <p style={{ fontSize: 11, color: '#FBBF24', margin: 0 }}>
                              ⚠ {total - done} step{total - done !== 1 ? 's' : ''} still pending — review before granting
                            </p>
                          )}
                          {allApproved && !c.is_verified && (
                            <p style={{ fontSize: 11, color: '#34D399', margin: 0 }}>
                              ✓ All steps approved — ready to grant the verified badge
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!c.is_verified && (
                            <button
                              onClick={() => grantBadge(c.id)}
                              disabled={isBadgeActing}
                              style={{
                                padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                                backgroundColor: allApproved ? '#1D9BF0' : 'rgba(29,155,240,0.3)',
                                color: allApproved ? '#fff' : 'rgba(255,255,255,0.6)',
                                opacity: isBadgeActing ? 0.6 : 1,
                                transition: 'all 0.15s',
                              }}>
                              {isBadgeActing ? 'Granting…' : '✓ Grant Verified Badge'}
                            </button>
                          )}
                          {c.is_verified && (
                            <button
                              onClick={() => revokeBadge(c.id)}
                              disabled={isBadgeActing}
                              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: isBadgeActing ? 0.6 : 1 }}>
                              {isBadgeActing ? 'Revoking…' : 'Revoke Badge'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
