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

type FilterTab = 'all' | 'pending' | 'under_review' | 'verified' | 'rejected'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const VERIF_PILL: Record<string, { text: string; bg: string; border: string }> = {
  verified:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  pending:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  rejected:     { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  under_review: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

function StatusPill({ value }: { value: string }) {
  const s = VERIF_PILL[value] ?? VERIF_PILL['pending']
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value.replace('_', ' ')}
    </span>
  )
}

function TrustBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: 'var(--tx-3)', fontSize: 12 }}>—</span>
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 5, backgroundColor: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
      </div>
      <span style={{ color, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{score}</span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CandidateVerificationPage() {
  const supabase = createClient()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('candidates')
      .select('id,user_id,full_name,email,verification_status,trust_score,created_at,skills,experience,status')
      .order('created_at', { ascending: false })
    if (!error) setCandidates((data ?? []) as Candidate[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateVerification(id: string, status: 'verified' | 'under_review' | 'rejected') {
    setActing(id)
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, verification_status: status } : c))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('candidates').update({ verification_status: status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.candidate_verification_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'candidate',
      severity: 'info',
      app: 'admin_panel',
    })
    setActing(null)
  }

  const filtered = filter === 'all' ? candidates : candidates.filter(c => c.verification_status === filter)

  const pending = candidates.filter(c => c.verification_status === 'pending').length
  const underReview = candidates.filter(c => c.verification_status === 'under_review').length
  const verified = candidates.filter(c => c.verification_status === 'verified').length
  const rejected = candidates.filter(c => c.verification_status === 'rejected').length
  const total = candidates.length
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0

  const today = new Date().toDateString()
  const verifiedToday = candidates.filter(c => c.verification_status === 'verified' && new Date(c.created_at).toDateString() === today).length

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'under_review', label: 'Under Review', count: underReview },
    { key: 'verified', label: 'Verified', count: verified },
    { key: 'rejected', label: 'Rejected', count: rejected },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar title="Candidate Verification" subtitle={`${pending} pending review · ${total} total candidates`} />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Pending Review', value: pending, color: '#FBBF24' },
            { label: 'Under Review', value: underReview, color: '#38BDF8' },
            { label: 'Verified Today', value: verifiedToday, color: '#34D399' },
            { label: 'Rejection Rate', value: `${rejectionRate}%`, color: '#F87171' },
          ].map(stat => (
            <div key={stat.label} style={{ ...CARD_STYLE, padding: '20px 24px' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: stat.color, margin: 0, fontFamily: 'var(--font-display)' }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)} style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', transition: 'all 0.15s',
              backgroundColor: filter === t.key ? '#6366F1' : 'var(--bg-elevated)',
              color: filter === t.key ? '#fff' : 'var(--tx-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t.label}
              <span style={{ backgroundColor: filter === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {['Candidate', 'Skills', 'Experience', 'Trust Score', 'Submitted', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '60%' }} /></td></tr>
              ))}
              {!loading && filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <td style={{ padding: '14px 20px' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{c.full_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{c.email}</p>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                      {(c.skills ?? []).slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 10, backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>{s}</span>
                      ))}
                      {(c.skills ?? []).length > 3 && <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>+{(c.skills ?? []).length - 3}</span>}
                      {!(c.skills ?? []).length && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)', maxWidth: 180 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.experience ?? '—'}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}><TrustBar score={c.trust_score} /></td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                  <td style={{ padding: '14px 20px' }}><StatusPill value={c.verification_status} /></td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.verification_status !== 'verified' && (
                        <button onClick={() => updateVerification(c.id, 'verified')} disabled={acting === c.id} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: acting === c.id ? 0.6 : 1 }}>Approve</button>
                      )}
                      {c.verification_status !== 'under_review' && (
                        <button onClick={() => updateVerification(c.id, 'under_review')} disabled={acting === c.id} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38BDF8', opacity: acting === c.id ? 0.6 : 1 }}>Review</button>
                      )}
                      {c.verification_status !== 'rejected' && (
                        <button onClick={() => updateVerification(c.id, 'rejected')} disabled={acting === c.id} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: acting === c.id ? 0.6 : 1 }}>Reject</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No candidates in this category.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
