'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

interface Candidate {
  id: string
  user_id: string
  full_name: string
  email: string
  verification_status: string
  trust_score: number | null
  created_at: string
  skills: string[] | null
  experience: string | null
  status: string
}

interface Company {
  id: string
  user_id: string
  name: string
  email: string
  verification_status: string
  industry: string | null
  created_at: string
  status: string
  website: string | null
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
  pending:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

const VERIF_PILL: Record<string, { text: string; bg: string; border: string }> = {
  verified:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  pending:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  rejected:     { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  under_review: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

function StatusPill({ value }: { value: string }) {
  const s = STATUS_PILL[value] ?? STATUS_PILL['pending']
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

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{ini.toUpperCase()}</span>
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
          <div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: i === 0 ? 140 : 80, animation: 'pulse 1.5s infinite' }} />
        </td>
      ))}
    </tr>
  )
}

type ConfirmState = { id: string; action: 'suspend' | 'ban' | 'reactivate' } | null

export default function UserManagementPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('candidates')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: cands }, { data: comps }] = await Promise.all([
      supabase.from('candidates').select('id,user_id,full_name,email,verification_status,trust_score,created_at,skills,experience,status').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,user_id,name,email,verification_status,industry,created_at,status,website').order('created_at', { ascending: false }),
    ])
    setCandidates((cands ?? []) as Candidate[])
    setCompanies((comps ?? []) as Company[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateStatus(table: 'candidates' | 'companies', id: string, action: 'suspend' | 'ban' | 'reactivate') {
    setActing(id)
    const newStatus = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active'
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from(table).update({ status: newStatus }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.user_${action}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: table === 'candidates' ? 'candidate' : 'company',
      severity: action === 'ban' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    if (table === 'candidates') {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    } else {
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    }
    setConfirm(null)
    setActing(null)
  }

  function exportCSV() {
    const rows = tab === 'candidates'
      ? filteredCandidates.map(c => `${c.full_name},${c.email},${c.verification_status},${c.trust_score ?? ''},${c.status},${formatDate(c.created_at)}`)
      : filteredCompanies.map(c => `${c.name},${c.email},${c.industry ?? ''},${c.status},${formatDate(c.created_at)}`)
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
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })
  const filteredCompanies = companies.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendingCands = candidates.filter(c => c.status === 'active').length
  const pendingComps = companies.filter(c => c.status === 'active').length

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

          {/* Search */}
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

          {/* Status filter */}
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

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {(tab === 'candidates'
                  ? ['User', 'Verification', 'Trust Score', 'Skills', 'Joined', 'Status', 'Actions']
                  : ['Company', 'Industry', 'Website', 'Verification', 'Joined', 'Status', 'Actions']
                ).map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              {!loading && tab === 'candidates' && filteredCandidates.map(c => {
                const isConfirming = confirm?.id === c.id
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Initials name={c.full_name} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.full_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}><VerifPill value={c.verification_status} /></td>
                    <td style={{ padding: '14px 20px' }}><TrustBar score={c.trust_score} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180 }}>
                        {(c.skills ?? []).slice(0, 3).map(s => (
                          <span key={s} style={{ fontSize: 10, backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>{s}</span>
                        ))}
                        {(c.skills ?? []).length > 3 && <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>+{(c.skills ?? []).length - 3}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={c.status || 'active'} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateStatus('candidates', c.id, confirm!.action)} disabled={acting === c.id} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: confirm!.action === 'ban' ? '#EF4444' : confirm!.action === 'suspend' ? '#FBBF24' : '#34D399', color: '#fff', opacity: acting === c.id ? 0.6 : 1 }}>Confirm</button>
                          <button onClick={() => setConfirm(null)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {c.status !== 'suspended' && c.status !== 'banned' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'suspend' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FBBF24', padding: 0 }}>Suspend</button>
                          )}
                          {(c.status === 'suspended') && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'reactivate' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#34D399', padding: 0 }}>Reactivate</button>
                          )}
                          {c.status !== 'banned' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'ban' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#F87171', padding: 0 }}>Ban</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && tab === 'companies' && filteredCompanies.map(c => {
                const isConfirming = confirm?.id === c.id
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{c.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{c.industry ?? '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: '#38BDF8' }}>
                      {c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', textDecoration: 'none' }}>{c.website.replace(/^https?:\/\//, '')}</a> : '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}><VerifPill value={c.verification_status} /></td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={c.status || 'active'} /></td>
                    <td style={{ padding: '14px 20px' }}>
                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateStatus('companies', c.id, confirm!.action)} disabled={acting === c.id} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: confirm!.action === 'ban' ? '#EF4444' : confirm!.action === 'suspend' ? '#FBBF24' : '#34D399', color: '#fff', opacity: acting === c.id ? 0.6 : 1 }}>Confirm</button>
                          <button onClick={() => setConfirm(null)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {c.status !== 'suspended' && c.status !== 'banned' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'suspend' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FBBF24', padding: 0 }}>Suspend</button>
                          )}
                          {c.status === 'suspended' && (
                            <button onClick={() => setConfirm({ id: c.id, action: 'reactivate' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#34D399', padding: 0 }}>Reactivate</button>
                          )}
                          {c.status !== 'banned' && (
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
