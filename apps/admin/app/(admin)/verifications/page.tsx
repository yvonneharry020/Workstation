'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

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
  website_url: string | null
  is_verified: boolean
  created_at: string
}

type MainTab = 'candidates' | 'companies'
type FilterTab = 'all' | 'pending' | 'under_review' | 'verified'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const VERIF_PILL: Record<string, { text: string; bg: string; border: string }> = {
  verified:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  pending:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  under_review: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

function getCandVerif(c: { nin_verified: boolean; phone_verified: boolean; liveness_verified: boolean }): string {
  if (c.nin_verified && c.phone_verified && c.liveness_verified) return 'verified'
  if (c.nin_verified || c.phone_verified || c.liveness_verified) return 'under_review'
  return 'pending'
}

function StatusPill({ value }: { value: string }) {
  const s = VERIF_PILL[value] ?? VERIF_PILL['pending']
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value.replace('_', ' ')}
    </span>
  )
}

function VerifBadges({ nin, phone, liveness }: { nin: boolean; phone: boolean; liveness: boolean }) {
  const checks = [
    { label: 'NIN', active: nin },
    { label: 'Phone', active: phone },
    { label: 'Face', active: liveness },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {checks.map(c => (
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function VerificationsPage() {
  const supabase = createClient()
  const [mainTab, setMainTab] = useState<MainTab>('candidates')
  const [filterTab, setFilterTab] = useState<FilterTab>('pending')
  const [candidates, setCandidates] = useState<CandidateVerif[]>([])
  const [companies, setCompanies] = useState<CompanyVerif[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: candProfiles },
      { data: compProfiles },
      { data: candAccounts },
      { data: compAccounts },
    ] = await Promise.all([
      supabase.from('candidate_profiles').select('id, first_name, last_name, nin_verified, phone_verified, liveness_verified, created_at'),
      supabase.from('company_profiles').select('id, company_name, industry, website_url, is_verified, created_at'),
      supabase.from('profiles').select('id, email').eq('role', 'candidate'),
      supabase.from('profiles').select('id, email').eq('role', 'company'),
    ])

    const candEmailMap = new Map((candAccounts ?? []).map(p => [p.id as string, p.email as string]))
    const compEmailMap = new Map((compAccounts ?? []).map(p => [p.id as string, p.email as string]))

    setCandidates((candProfiles ?? []).map(cp => ({
      id: cp.id,
      first_name: cp.first_name,
      last_name: cp.last_name,
      email: candEmailMap.get(cp.id) ?? '—',
      nin_verified: cp.nin_verified,
      phone_verified: cp.phone_verified,
      liveness_verified: cp.liveness_verified,
      created_at: cp.created_at,
    })))

    setCompanies((compProfiles ?? []).map(cp => ({
      id: cp.id,
      company_name: cp.company_name,
      email: compEmailMap.get(cp.id) ?? '—',
      industry: cp.industry,
      website_url: cp.website_url,
      is_verified: cp.is_verified,
      created_at: cp.created_at,
    })))

    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

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

  async function approveCompany(id: string) {
    setActing(id)
    await supabase.from('company_profiles').update({ is_verified: true }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.company_verification_approved', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'company', severity: 'info', app: 'admin_panel',
    })
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, is_verified: true } : c))
    setActing(null)
  }

  async function rejectCompany(id: string) {
    setActing(id)
    await supabase.from('company_profiles').update({ is_verified: false }).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.company_verification_rejected', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'company', severity: 'info', app: 'admin_panel',
    })
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, is_verified: false } : c))
    setActing(null)
  }

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
    { key: 'pending' as FilterTab, label: 'Unverified', count: companies.filter(c => !c.is_verified).length },
    { key: 'verified' as FilterTab, label: 'Verified', count: companies.filter(c => c.is_verified).length },
  ]

  const filterTabs = mainTab === 'candidates' ? CAND_TABS : COMP_TABS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        title="Verification Queue"
        subtitle={`${pendingCands} candidates pending · ${pendingComps} companies unverified`}
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

        {/* Candidates table */}
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
                      <td style={{ padding: '14px 20px' }}>
                        <VerifBadges nin={c.nin_verified} phone={c.phone_verified} liveness={c.liveness_verified} />
                      </td>
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

        {/* Companies table */}
        {mainTab === 'companies' && (
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Company', 'Industry', 'Website', 'Email', 'Registered', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '60%' }} /></td></tr>
                ))}
                {!loading && filteredCompanies.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{c.company_name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.company_name}</p>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{c.industry ?? '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12 }}>
                      {c.website_url
                        ? <a href={c.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', textDecoration: 'none' }}>{c.website_url.replace(/^https?:\/\//, '').slice(0, 28)}</a>
                        : <span style={{ color: 'var(--tx-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)' }}>{c.email}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={c.is_verified ? 'verified' : 'pending'} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!c.is_verified && (
                          <button onClick={() => approveCompany(c.id)} disabled={acting === c.id}
                            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: acting === c.id ? 0.6 : 1 }}>
                            Approve
                          </button>
                        )}
                        {c.is_verified && (
                          <button onClick={() => rejectCompany(c.id)} disabled={acting === c.id}
                            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: acting === c.id ? 0.6 : 1 }}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredCompanies.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No companies in this category.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
