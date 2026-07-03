'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

interface CandidateData {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  is_suspended: boolean
  nin_verified: boolean
  phone_verified: boolean
  liveness_verified: boolean
  trust_score: number | null
  created_at: string
  avatar_url: string | null
}

interface CompanyData {
  id: string
  company_name: string
  email: string
  is_active: boolean
  is_suspended: boolean
  industry: string | null
  website_url: string | null
  is_verified: boolean
  created_at: string
  logo_url: string | null
}

type Tab = 'candidates' | 'companies'
type StatusFilter = 'all' | 'active' | 'suspended' | 'banned'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const STATUS_PILL: Record<string, { text: string; bg: string; border: string }> = {
  active:    { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  suspended: { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  banned:    { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

const VERIF_PILL: Record<string, { text: string; bg: string; border: string }> = {
  verified:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  pending:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  under_review: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

function getStatus(row: { is_active: boolean; is_suspended: boolean }): string {
  if (!row.is_active) return 'banned'
  if (row.is_suspended) return 'suspended'
  return 'active'
}

function getCandVerif(row: { nin_verified: boolean; phone_verified: boolean; liveness_verified: boolean }): string {
  if (row.nin_verified && row.phone_verified && row.liveness_verified) return 'verified'
  if (row.nin_verified || row.phone_verified || row.liveness_verified) return 'under_review'
  return 'pending'
}

function StatusPill({ value }: { value: string }) {
  const s = STATUS_PILL[value] ?? STATUS_PILL['active']
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value}
    </span>
  )
}

function VerifPill({ value }: { value: string }) {
  const s = VERIF_PILL[value] ?? VERIF_PILL['pending']
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value.replace('_', ' ')}
    </span>
  )
}

function TrustBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: 'var(--tx-3)', fontSize: 12 }}>—</span>
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 48, height: 4, backgroundColor: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
      </div>
      <span style={{ color, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{score}</span>
    </div>
  )
}

function UserAvatar({ name, avatarUrl, shape = 'circle' }: { name: string; avatarUrl?: string | null; shape?: 'circle' | 'rounded' }) {
  const parts = name.trim().split(' ')
  const ini = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  const radius = shape === 'circle' ? '50%' : '10px'
  const bg = shape === 'circle' ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'linear-gradient(135deg, #10B981, #059669)'
  return (
    <div style={{ width: 36, height: 36, borderRadius: radius, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{ini}</span>
      }
    </div>
  )
}

function VerifBadges({ nin, phone, liveness }: { nin: boolean; phone: boolean; liveness: boolean }) {
  const badges = [
    { key: 'NIN', active: nin },
    { key: 'Phone', active: phone },
    { key: 'Face', active: liveness },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {badges.map(b => (
        <span key={b.key} style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 99,
          backgroundColor: b.active ? 'rgba(52,211,153,0.1)' : 'var(--bg-elevated)',
          color: b.active ? '#34D399' : 'var(--tx-3)',
          border: `1px solid ${b.active ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
          fontWeight: 600,
        }}>{b.key}</span>
      ))}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} style={{ padding: '14px 20px' }}>
          <div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: i === 0 ? 140 : 80 }} />
        </td>
      ))}
    </tr>
  )
}

type ConfirmState = { id: string; action: 'suspend' | 'ban' | 'reactivate' } | null

export default function UserManagementPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('candidates')
  const [candidates, setCandidates] = useState<CandidateData[]>([])
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: candProfiles },
      { data: compProfiles },
      { data: candAccounts },
      { data: compAccounts },
      { data: trustData },
    ] = await Promise.all([
      supabase.from('candidate_profiles').select('id, first_name, last_name, nin_verified, phone_verified, liveness_verified, avatar_url'),
      supabase.from('company_profiles').select('id, company_name, industry, website_url, is_verified, logo_url'),
      supabase.from('profiles').select('id, email, is_active, is_suspended, created_at').eq('role', 'candidate').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, is_active, is_suspended, created_at').eq('role', 'company').order('created_at', { ascending: false }),
      supabase.from('trust_scores').select('profile_id, score'),
    ])

    const trustMap = new Map((trustData ?? []).map(t => [t.profile_id as string, t.score as number]))
    const candProfileMap = new Map((candProfiles ?? []).map(p => [p.id as string, p]))
    const compProfileMap = new Map((compProfiles ?? []).map(p => [p.id as string, p]))

    const mergedCandidates = (candAccounts ?? []).flatMap(acc => {
      const cp = candProfileMap.get(acc.id)
      if (!cp) return []
      return [{
        id: acc.id,
        first_name: cp.first_name,
        last_name: cp.last_name,
        email: acc.email,
        is_active: acc.is_active,
        is_suspended: acc.is_suspended,
        nin_verified: cp.nin_verified,
        phone_verified: cp.phone_verified,
        liveness_verified: cp.liveness_verified,
        trust_score: trustMap.get(acc.id) ?? null,
        created_at: acc.created_at,
        avatar_url: (cp as { avatar_url?: string | null }).avatar_url ?? null,
      } as CandidateData]
    })

    const mergedCompanies = (compAccounts ?? []).flatMap(acc => {
      const cp = compProfileMap.get(acc.id)
      if (!cp) return []
      return [{
        id: acc.id,
        company_name: cp.company_name,
        email: acc.email,
        is_active: acc.is_active,
        is_suspended: acc.is_suspended,
        industry: cp.industry,
        website_url: cp.website_url,
        is_verified: cp.is_verified,
        created_at: acc.created_at,
        logo_url: (cp as { logo_url?: string | null }).logo_url ?? null,
      } as CompanyData]
    })

    setCandidates(mergedCandidates)
    setCompanies(mergedCompanies)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, action: 'suspend' | 'ban' | 'reactivate') {
    setActing(id)
    const updates = action === 'suspend' ? { is_suspended: true } :
                    action === 'ban'     ? { is_active: false }   :
                                          { is_active: true, is_suspended: false }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update(updates).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.user_${action}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: tab === 'candidates' ? 'candidate' : 'company',
      severity: action === 'ban' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    if (tab === 'candidates') {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    } else {
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    }
    setConfirm(null)
    setActing(null)
  }

  function exportCSV() {
    const rows = tab === 'candidates'
      ? filteredCandidates.map(c => `${c.first_name} ${c.last_name},${c.email},${getCandVerif(c)},${c.trust_score ?? ''},${getStatus(c)},${formatDate(c.created_at)}`)
      : filteredCompanies.map(c => `${c.company_name},${c.email},${c.industry ?? ''},${getStatus(c)},${formatDate(c.created_at)}`)
    const header = tab === 'candidates'
      ? 'Name,Email,Verification,Trust Score,Status,Joined'
      : 'Company,Email,Industry,Status,Joined'
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab}-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredCandidates = candidates.filter(c => {
    const status = getStatus(c)
    const fullName = `${c.first_name} ${c.last_name}`
    const matchSearch = !search || fullName.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || status === statusFilter
    return matchSearch && matchStatus
  })

  const filteredCompanies = companies.filter(c => {
    const status = getStatus(c)
    const matchSearch = !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar title="User Management" subtitle={`${candidates.length} candidates · ${companies.length} companies`} />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['candidates', 'companies'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              backgroundColor: tab === t ? '#6366F1' : 'var(--bg-elevated)',
              color: tab === t ? '#fff' : 'var(--tx-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t === 'candidates' ? 'Candidates' : 'Companies'}
              <span style={{ backgroundColor: tab === t ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>
                {t === 'candidates' ? candidates.length : companies.length}
              </span>
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email..."
              style={{ paddingLeft: 32, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', width: 220 }}
            />
          </div>

          {(['all', 'active', 'suspended', 'banned'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', textTransform: 'capitalize',
              backgroundColor: statusFilter === s ? 'var(--bg-elevated)' : 'transparent',
              color: statusFilter === s ? 'var(--tx-1)' : 'var(--tx-3)',
            }}>
              {s}
            </button>
          ))}

          <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
        </div>

        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {(tab === 'candidates'
                  ? ['User', 'Verification', 'Trust Score', 'Verified Checks', 'Joined', 'Status', 'Actions']
                  : ['Company', 'Industry', 'Website', 'Verified', 'Joined', 'Status', 'Actions']
                ).map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && tab === 'candidates' && filteredCandidates.map(c => {
                const status = getStatus(c)
                const verifStatus = getCandVerif(c)
                const isConfirming = confirm?.id === c.id
                const fullName = `${c.first_name} ${c.last_name}`
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar name={fullName} avatarUrl={c.avatar_url} shape="circle" />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{fullName}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}><VerifPill value={verifStatus} /></td>
                    <td style={{ padding: '14px 20px' }}><TrustBar score={c.trust_score} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      <VerifBadges nin={c.nin_verified} phone={c.phone_verified} liveness={c.liveness_verified} />
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={status} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateStatus(c.id, confirm!.action)} disabled={acting === c.id} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: confirm!.action === 'ban' ? '#EF4444' : confirm!.action === 'suspend' ? '#FBBF24' : '#34D399', color: '#fff', opacity: acting === c.id ? 0.6 : 1 }}>Confirm</button>
                          <button onClick={() => setConfirm(null)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {status === 'active' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'suspend' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FBBF24', padding: 0 }}>Suspend</button>
                          )}
                          {status === 'suspended' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'reactivate' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#34D399', padding: 0 }}>Reactivate</button>
                          )}
                          {status !== 'banned' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'ban' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#F87171', padding: 0 }}>Ban</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!loading && tab === 'companies' && filteredCompanies.map(c => {
                const status = getStatus(c)
                const isConfirming = confirm?.id === c.id
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar name={c.company_name} avatarUrl={c.logo_url} shape="rounded" />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.company_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{c.industry ?? '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12 }}>
                      {c.website_url
                        ? <a href={c.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', textDecoration: 'none' }}>{c.website_url.replace(/^https?:\/\//, '')}</a>
                        : <span style={{ color: 'var(--tx-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px' }}><VerifPill value={c.is_verified ? 'verified' : 'pending'} /></td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={status} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateStatus(c.id, confirm!.action)} disabled={acting === c.id} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: confirm!.action === 'ban' ? '#EF4444' : confirm!.action === 'suspend' ? '#FBBF24' : '#34D399', color: '#fff', opacity: acting === c.id ? 0.6 : 1 }}>Confirm</button>
                          <button onClick={() => setConfirm(null)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {status === 'active' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'suspend' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FBBF24', padding: 0 }}>Suspend</button>
                          )}
                          {status === 'suspended' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'reactivate' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#34D399', padding: 0 }}>Reactivate</button>
                          )}
                          {status !== 'banned' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'ban' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#F87171', padding: 0 }}>Ban</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!loading && ((tab === 'candidates' && filteredCandidates.length === 0) || (tab === 'companies' && filteredCompanies.length === 0)) && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                    No {tab} found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
