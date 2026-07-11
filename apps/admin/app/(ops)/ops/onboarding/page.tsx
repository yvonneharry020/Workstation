'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface FunnelStep {
  label: string
  count: number
  pct: number
  dropOff: number
}

function stepColor(pct: number) {
  if (pct >= 60) return '#34D399'
  if (pct >= 30) return '#FBBF24'
  return '#F87171'
}

export default function OnboardingFunnelPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [candidateSteps, setCandidateSteps] = useState<FunnelStep[]>([])
  const [companySteps, setCompanySteps] = useState<FunnelStep[]>([])
  const [totals, setTotals] = useState({ candidates: 0, companies: 0, candidateAvg: 0, companyAvg: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    const [
      allCandidates,
      profileCompleted,
      cvUploaded,
      verificationSubmitted,
      firstApplication,
      verified,
      allCompanies,
      companyProfileCompleted,
      firstJobPosted,
      companyVerifSubmitted,
      companyVerified,
      companyHired,
    ] = await Promise.all([
      supabase.from('candidates').select('id', { count: 'exact', head: true }),
      supabase.from('candidates').select('id', { count: 'exact', head: true }).not('full_name', 'is', null).not('skills', 'is', null),
      supabase.from('cv_versions').select('candidate_id', { count: 'exact', head: true }),
      supabase.from('candidates').select('id', { count: 'exact', head: true }).neq('verification_status', 'pending'),
      supabase.from('job_applications').select('candidate_id', { count: 'exact', head: true }),
      supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('companies').select('id', { count: 'exact', head: true }).not('company_name', 'is', null).not('industry', 'is', null),
      supabase.from('job_postings').select('company_id', { count: 'exact', head: true }),
      supabase.from('companies').select('id', { count: 'exact', head: true }).neq('verification_status', 'pending'),
      supabase.from('companies').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'hired'),
    ])

    const cTotal = allCandidates.count ?? 0
    const cCounts = [
      cTotal,
      profileCompleted.count ?? 0,
      cvUploaded.count ?? 0,
      verificationSubmitted.count ?? 0,
      firstApplication.count ?? 0,
      verified.count ?? 0,
    ]
    const cLabels = ['Account Created', 'Profile Completed', 'CV Uploaded', 'Verification Submitted', 'First Application', 'Verified']
    const cSteps: FunnelStep[] = cCounts.map((count, i) => ({
      label: cLabels[i],
      count,
      pct: cTotal > 0 ? Math.round((count / cTotal) * 100) : 0,
      dropOff: i > 0 && cCounts[i - 1] > 0 ? Math.round(((cCounts[i - 1] - count) / cCounts[i - 1]) * 100) : 0,
    }))

    const coTotal = allCompanies.count ?? 0
    const coCounts = [
      coTotal,
      companyProfileCompleted.count ?? 0,
      firstJobPosted.count ?? 0,
      companyVerifSubmitted.count ?? 0,
      companyVerified.count ?? 0,
      companyHired.count ?? 0,
    ]
    const coLabels = ['Account Created', 'Profile Completed', 'First Job Posted', 'Verification Submitted', 'Verified', 'First Hire Made']
    const coSteps: FunnelStep[] = coCounts.map((count, i) => ({
      label: coLabels[i],
      count,
      pct: coTotal > 0 ? Math.round((count / coTotal) * 100) : 0,
      dropOff: i > 0 && coCounts[i - 1] > 0 ? Math.round(((coCounts[i - 1] - count) / coCounts[i - 1]) * 100) : 0,
    }))

    setCandidateSteps(cSteps)
    setCompanySteps(coSteps)

    const cAvg = cSteps.length > 0 ? Math.round(cSteps.reduce((s, x) => s + x.pct, 0) / cSteps.length) : 0
    const coAvg = coSteps.length > 0 ? Math.round(coSteps.reduce((s, x) => s + x.pct, 0) / coSteps.length) : 0
    setTotals({ candidates: cTotal, companies: coTotal, candidateAvg: cAvg, companyAvg: coAvg })
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function FunnelSection({ title, steps, color }: { title: string; steps: FunnelStep[]; color: string }) {
    return (
      <div style={CARD} className="p-5">
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 20 }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((step, i) => (
            <div key={step.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{step.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{step.count.toLocaleString('en-NG')}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: stepColor(step.pct) }}>{step.pct}%</span>
                </div>
              </div>
              <div style={{ height: 6, backgroundColor: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${step.pct}%`, backgroundColor: stepColor(step.pct), borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              {i > 0 && step.dropOff > 0 && (
                <p style={{ fontSize: 10, color: '#F87171', marginTop: 3 }}>↓ {step.dropOff}% dropped off from previous step</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Onboarding Funnel" subtitle="Track user onboarding completion across all steps" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Candidates', value: totals.candidates.toLocaleString('en-NG'), color: '#38BDF8' },
            { label: 'Total Companies', value: totals.companies.toLocaleString('en-NG'), color: '#34D399' },
            { label: 'Candidate Avg Completion', value: `${totals.candidateAvg}%`, color: stepColor(totals.candidateAvg) },
            { label: 'Company Avg Completion', value: `${totals.companyAvg}%`, color: stepColor(totals.companyAvg) },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ ...CARD, padding: 48, textAlign: 'center' }}><p style={{ color: 'var(--tx-3)' }}>Loading funnel data…</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            <FunnelSection title="Candidate Onboarding Funnel" steps={candidateSteps} color="#38BDF8" />
            <FunnelSection title="Company Onboarding Funnel" steps={companySteps} color="#34D399" />
          </div>
        )}
      </div>
    </div>
  )
}
