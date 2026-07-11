'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

// ─── Types ───────────────────────────────────────────────────────────────────

type VerifStatus = 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_resubmission'

interface CompanyDetail {
  id: string
  company_name: string
  email: string
  industry: string | null
  city: string | null
  website: string | null
  logo_url: string | null
  is_verified: boolean
  cac_verified: boolean
  director_nin_verified: boolean
  created_at: string
}

interface VerificationRecord {
  overall_status: VerifStatus
  cac_status: VerifStatus
  director_nin_status: VerifStatus
  domain_status: VerifStatus
  documents_status: VerifStatus
  manual_review_status: VerifStatus
  updated_at: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

// These steps are verified by third-party APIs (Dojah / Smile Identity / automated).
// Admin does NOT approve or reject these — they are read-only.
const VERIF_STEPS: {
  key: keyof Omit<VerificationRecord, 'overall_status' | 'manual_review_status' | 'updated_at'>
  label: string
  provider: string
  description: string
  icon: string
}[] = [
  {
    key: 'cac_status',
    label: 'CAC Registration',
    provider: 'Dojah',
    description: 'Corporate Affairs Commission registration verified against the CAC database.',
    icon: '🏢',
  },
  {
    key: 'director_nin_status',
    label: 'Director NIN Verification',
    provider: 'Smile Identity',
    description: "Company director's National Identification Number verified via biometric check.",
    icon: '🪪',
  },
  {
    key: 'domain_status',
    label: 'Business Email Domain',
    provider: 'Automated',
    description: 'Business email domain ownership verified (DNS TXT record or inbox confirmation).',
    icon: '🌐',
  },
  {
    key: 'documents_status',
    label: 'Business Documents',
    provider: 'Automated',
    description: 'Supporting business documents (e.g., MEMART, utility bill) uploaded and scanned.',
    icon: '📄',
  },
]

const STATUS_CONFIG: Record<VerifStatus, { label: string; color: string; bg: string; dot: string }> = {
  approved:              { label: 'Passed',         color: '#34D399', bg: 'rgba(52,211,153,0.10)',  dot: '#34D399' },
  in_review:             { label: 'In Review',      color: '#38BDF8', bg: 'rgba(56,189,248,0.10)',  dot: '#38BDF8' },
  pending:               { label: 'Pending',        color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  dot: '#FBBF24' },
  rejected:              { label: 'Failed',         color: '#F87171', bg: 'rgba(248,113,113,0.10)', dot: '#F87171' },
  requires_resubmission: { label: 'Needs Resubmit', color: '#FB923C', bg: 'rgba(251,146,60,0.10)',  dot: '#FB923C' },
  not_started:           { label: 'Not Started',    color: '#64748B', bg: 'rgba(100,116,139,0.08)', dot: '#64748B' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, status }: {
  step: typeof VERIF_STEPS[number]
  status: VerifStatus
}) {
  const cfg = STATUS_CONFIG[status]
  const passed = status === 'approved'

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: `1px solid ${passed ? 'rgba(52,211,153,0.25)' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
      transition: 'border-color 0.15s',
    }}>
      {/* Icon + status dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: passed ? 'rgba(52,211,153,0.12)' : 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}>
          {step.icon}
        </div>
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: cfg.dot,
          border: '2px solid var(--bg-card)',
        }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{step.label}</p>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            backgroundColor: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.color}40`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            fontFamily: 'monospace',
          }}>{cfg.label}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0, lineHeight: 1.5 }}>{step.description}</p>
        <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: '6px 0 0', opacity: 0.7 }}>
          Verified by: <span style={{ fontWeight: 600, color: 'var(--tx-2)' }}>{step.provider}</span>
        </p>
      </div>

      {/* Check or placeholder */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {passed ? (
          <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L9.5 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)' }} />
        )}
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function CompanyVerificationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const companyId = params.id as string

  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [verif, setVerif] = useState<VerificationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data: cp }, { data: vr }, { data: profile }] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('id', companyId).single(),
      supabase.from('company_verification').select('*').eq('company_id', companyId).single(),
      supabase.from('profiles').select('email').eq('id', companyId).single(),
    ])

    if (cp) {
      setCompany({
        id: cp.id,
        company_name: cp.company_name,
        email: profile?.email ?? '—',
        industry: cp.industry ?? null,
        city: cp.city ?? null,
        website: cp.website ?? null,
        logo_url: cp.logo_url ?? null,
        is_verified: cp.is_verified ?? false,
        cac_verified: cp.cac_verified ?? false,
        director_nin_verified: cp.director_nin_verified ?? false,
        created_at: cp.created_at,
      })
    }

    if (vr) {
      setVerif({
        overall_status: vr.overall_status as VerifStatus,
        cac_status: vr.cac_status as VerifStatus,
        director_nin_status: vr.director_nin_status as VerifStatus,
        domain_status: vr.domain_status as VerifStatus,
        documents_status: vr.documents_status as VerifStatus,
        manual_review_status: vr.manual_review_status as VerifStatus,
        updated_at: vr.updated_at ?? null,
      })
    }

    setLoading(false)
  }, [supabase, companyId])

  useEffect(() => { void load() }, [load])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const allStepsPassed = verif
    ? VERIF_STEPS.every(s => verif[s.key] === 'approved')
    : false

  const passedCount = verif
    ? VERIF_STEPS.filter(s => verif[s.key] === 'approved').length
    : 0

  async function grantBadge() {
    if (!company) return
    setGranting(true)

    const { error: profileErr } = await supabase
      .from('company_profiles')
      .update({ is_verified: true })
      .eq('id', companyId)

    const { error: verifErr } = await supabase
      .from('company_verification')
      .update({ overall_status: 'approved', manual_review_status: 'approved' })
      .eq('company_id', companyId)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.company_badge_granted',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: companyId,
      target_type: 'company',
      severity: 'info',
      app: 'admin_panel',
      metadata: { company_name: company.company_name },
    })

    if (profileErr || verifErr) {
      showToast('Failed to grant badge. Please try again.', 'error')
    } else {
      showToast(`Verified badge granted to ${company.company_name}`, 'success')
      setCompany(prev => prev ? { ...prev, is_verified: true } : prev)
      setVerif(prev => prev ? { ...prev, overall_status: 'approved', manual_review_status: 'approved' } : prev)
    }

    setGranting(false)
  }

  async function revokeBadge() {
    if (!company) return
    setRevoking(true)

    const { error: profileErr } = await supabase
      .from('company_profiles')
      .update({ is_verified: false })
      .eq('id', companyId)

    const { error: verifErr } = await supabase
      .from('company_verification')
      .update({ overall_status: 'in_review', manual_review_status: 'in_review' })
      .eq('company_id', companyId)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.company_badge_revoked',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: companyId,
      target_type: 'company',
      severity: 'warn',
      app: 'admin_panel',
      metadata: { company_name: company.company_name },
    })

    if (profileErr || verifErr) {
      showToast('Failed to revoke badge. Please try again.', 'error')
    } else {
      showToast(`Verified badge revoked from ${company.company_name}`, 'success')
      setCompany(prev => prev ? { ...prev, is_verified: false } : prev)
      setVerif(prev => prev ? { ...prev, overall_status: 'in_review', manual_review_status: 'in_review' } : prev)
    }

    setRevoking(false)
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar title="Company Verification" subtitle="Loading…" />
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 80, backgroundColor: 'var(--bg-elevated)', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar title="Not Found" subtitle="Company not found" />
        <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 14 }}>
          <p>This company profile doesn&apos;t exist or was deleted.</p>
          <button onClick={() => router.push('/verifications')} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ← Back to Queue
          </button>
        </div>
      </div>
    )
  }

  const initials = company.company_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        title={company.company_name}
        subtitle={`Verification review · ${company.email}`}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 1000,
          backgroundColor: toast.type === 'success' ? '#34D399' : '#F87171',
          color: '#fff', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>

        {/* Back */}
        <button
          onClick={() => router.push('/verifications')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6366F1', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, width: 'fit-content' }}
        >
          ← Back to Queue
        </button>

        {/* Company card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', display: 'flex', gap: 20, alignItems: 'flex-start', boxShadow: 'var(--shadow-card)' }}>
          {/* Logo */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: company.is_verified ? 'linear-gradient(135deg, #1D9BF0, #0EA5E9)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
          }}>
            {company.logo_url
              ? <img src={company.logo_url} alt={company.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{initials}</span>
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>{company.company_name}</h2>
              {company.is_verified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#1D9BF0', backgroundColor: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.3)', borderRadius: 7, padding: '3px 9px' }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
                    <path d="M6 12.5L9.8 16.5L18.5 7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  VERIFIED
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              {[
                company.email,
                company.industry,
                company.city,
                company.website,
                `Joined ${formatDate(company.created_at)}`,
              ].filter(Boolean).map((val, i) => (
                <span key={i} style={{ fontSize: 12, color: 'var(--tx-3)' }}>{val}</span>
              ))}
            </div>
          </div>

          {/* Progress ring summary */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `conic-gradient(${passedCount === VERIF_STEPS.length ? '#34D399' : '#6366F1'} ${(passedCount / VERIF_STEPS.length) * 360}deg, var(--bg-elevated) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: passedCount === VERIF_STEPS.length ? '#34D399' : 'var(--tx-1)' }}>{passedCount}/{VERIF_STEPS.length}</span>
              </div>
            </div>
            <p style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 6, fontWeight: 600 }}>STEPS</p>
          </div>
        </div>

        {/* No verification record yet */}
        {!verif && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>⏳</p>
            <p style={{ color: 'var(--tx-1)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No verification started</p>
            <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>This company hasn&apos;t gone through any verification steps yet.</p>
          </div>
        )}

        {/* Verification steps — all read-only */}
        {verif && (
          <>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Verification Steps</h3>
                  <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>
                    Verified automatically by third-party APIs — view only.
                    {verif.updated_at ? ` Last updated ${formatDate(verif.updated_at)}.` : ''}
                  </p>
                </div>
                {allStepsPassed && !company.is_verified && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '5px 12px' }}>
                    ✓ All steps complete
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {VERIF_STEPS.map(step => (
                  <StepCard key={step.key} step={step} status={verif[step.key]} />
                ))}
              </div>
            </div>

            {/* Auto-set flags from company_profiles (informational) */}
            <div style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, padding: '14px 18px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Auto-set profile flags</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Flag label="CAC Verified flag" active={company.cac_verified} />
                <Flag label="Director NIN flag" active={company.director_nin_verified} />
              </div>
            </div>

            {/* Grant / Revoke section */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${allStepsPassed && !company.is_verified ? 'rgba(29,155,240,0.3)' : 'var(--border)'}`, borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-card)' }}>
              {company.is_verified ? (
                /* Already verified */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(29,155,240,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
                        <path d="M6 12.5L9.8 16.5L18.5 7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1D9BF0', margin: 0 }}>Verified Badge Active</p>
                      <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>{company.company_name} has the verified badge and it is visible to candidates.</p>
                    </div>
                  </div>
                  <button
                    onClick={revokeBadge}
                    disabled={revoking}
                    style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)', color: '#F87171', fontSize: 13, fontWeight: 700, cursor: revoking ? 'not-allowed' : 'pointer', opacity: revoking ? 0.6 : 1 }}
                  >
                    {revoking ? 'Revoking…' : 'Revoke Verified Badge'}
                  </button>
                </div>
              ) : (
                /* Not yet verified */
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 6px' }}>Grant Verified Badge</p>
                    <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>
                      {allStepsPassed
                        ? 'All verification steps have passed. You can now grant the verified badge to this company.'
                        : `${VERIF_STEPS.length - passedCount} verification ${VERIF_STEPS.length - passedCount === 1 ? 'step is' : 'steps are'} not yet passed. The company must complete all steps before receiving the badge.`}
                    </p>
                  </div>

                  {!allStepsPassed && (
                    <div style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>⚠</span>
                      <p style={{ fontSize: 12, color: '#FBBF24', margin: 0, fontWeight: 600 }}>
                        {VERIF_STEPS.length - passedCount} of {VERIF_STEPS.length} steps still pending
                      </p>
                    </div>
                  )}

                  <button
                    onClick={grantBadge}
                    disabled={!allStepsPassed || granting}
                    style={{
                      padding: '12px 28px',
                      borderRadius: 12,
                      border: 'none',
                      backgroundColor: allStepsPassed ? '#1D9BF0' : 'var(--bg-elevated)',
                      color: allStepsPassed ? '#fff' : 'var(--tx-3)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: allStepsPassed && !granting ? 'pointer' : 'not-allowed',
                      opacity: granting ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.2" />
                      <path d="M6 12.5L9.8 16.5L18.5 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {granting ? 'Granting Badge…' : 'Grant Verified Badge'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7,
      backgroundColor: active ? 'rgba(52,211,153,0.1)' : 'var(--bg-surface)',
      color: active ? '#34D399' : 'var(--tx-3)',
      border: `1px solid ${active ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
    }}>
      {active ? '✓' : '○'} {label}
    </span>
  )
}
