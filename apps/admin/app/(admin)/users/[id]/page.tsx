'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type Tab = 'overview' | 'applications' | 'cvs' | 'portfolio' | 'tickets' | 'badges' | 'audit'

interface UserProfile {
  id: string
  full_name: string
  email: string
  verification_status: string
  trust_score: number | null
  skills: string[] | null
  experience: string | null
  status: string
  created_at: string
  type: 'candidate' | 'company'
  company_name?: string
  industry?: string
  website?: string
}

interface Application {
  id: string
  job_id: string
  status: string
  created_at: string
  job_postings?: { title: string }
}

interface CV {
  id: string
  title: string
  template_id: string | null
  is_active: boolean
  created_at: string
}

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  tags: string[] | null
  is_featured: boolean
  created_at: string
}

interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  created_at: string
}

interface Badge {
  id: string
  role_held: string
  issued_at: string
  is_verified: boolean
  company_profiles?: { company_name: string }
}

interface AuditEntry {
  id: string
  event: string
  actor_email: string | null
  severity: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeDiff(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

const STATUS_PILL: Record<string, { text: string; bg: string; border: string }> = {
  active:       { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  suspended:    { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  banned:       { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  verified:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  pending:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  rejected:     { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  under_review: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  applied:      { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  screening:    { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)',border: 'rgba(167,139,250,0.3)' },
  interview:    { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  offer:        { text: '#FB923C', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
  hired:        { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  open:         { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  resolved:     { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  info:         { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  warning:      { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  critical:     { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

function Pill({ value }: { value: string }) {
  const s = STATUS_PILL[value] ?? { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' }
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

export default function UserProfilePage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [cvs, setCvs] = useState<CV[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [acting, setActing] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // Try candidate first, then company
    let userProfile: UserProfile | null = null
    const { data: cand } = await supabase.from('candidates').select('*').eq('id', id).single()
    if (cand) {
      userProfile = { ...cand, type: 'candidate' }
    } else {
      const { data: comp } = await supabase.from('companies').select('*').eq('id', id).single()
      if (comp) userProfile = { id: comp.id, full_name: comp.name, email: comp.email, verification_status: comp.verification_status, trust_score: null, skills: null, experience: null, status: comp.status ?? 'active', created_at: comp.created_at, type: 'company', company_name: comp.name, industry: comp.industry, website: comp.website }
    }
    setProfile(userProfile)

    const [appsRes, cvsRes, portRes, ticketsRes, badgesRes, auditRes] = await Promise.all([
      supabase.from('job_applications').select('*, job_postings(title)').eq('candidate_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('cv_versions').select('*').eq('candidate_id', id).order('created_at', { ascending: false }),
      supabase.from('portfolio_items').select('*').eq('candidate_id', id).order('created_at', { ascending: false }).limit(12),
      supabase.from('support_tickets').select('id,subject,status,priority,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('badges').select('*, company_profiles(company_name)').eq('recipient_id', id).order('issued_at', { ascending: false }).limit(10),
      supabase.from('audit_logs').select('id,event,actor_email,severity,created_at').eq('target_id', id).order('created_at', { ascending: false }).limit(30),
    ])

    setApplications((appsRes.data ?? []) as Application[])
    setCvs((cvsRes.data ?? []) as CV[])
    setPortfolio((portRes.data ?? []) as PortfolioItem[])
    setTickets((ticketsRes.data ?? []) as Ticket[])
    setBadges((badgesRes.data ?? []) as Badge[])
    setAudit((auditRes.data ?? []) as AuditEntry[])
    setLoading(false)
  }, [supabase, id])

  useEffect(() => { void load() }, [load])

  async function doAction(action: 'suspend' | 'ban' | 'reactivate' | 'verify') {
    if (!profile) return
    setActing(action)
    const table = profile.type === 'candidate' ? 'candidates' : 'companies'
    const updates: Record<string, string> = {}
    if (action === 'suspend') updates.status = 'suspended'
    if (action === 'ban') updates.status = 'banned'
    if (action === 'reactivate') updates.status = 'active'
    if (action === 'verify') updates.verification_status = 'verified'

    await supabase.from(table).update(updates).eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: `admin.user_${action}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: profile.type,
      severity: action === 'ban' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    setProfile(prev => {
      if (!prev) return prev
      return {
        ...prev,
        status: updates.status ?? prev.status,
        verification_status: updates.verification_status ?? prev.verification_status,
      }
    })
    setActing(null)
    setConfirmAction(null)
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'applications', label: 'Applications', count: applications.length },
    { key: 'cvs', label: 'CVs', count: cvs.length },
    { key: 'portfolio', label: 'Portfolio', count: portfolio.length },
    { key: 'tickets', label: 'Tickets', count: tickets.length },
    { key: 'badges', label: 'Badges', count: badges.length },
    { key: 'audit', label: 'Audit Trail', count: audit.length },
  ]

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
        <TopBar title="User Profile" subtitle="Loading…" />
        <div className="p-8 flex items-center justify-center">
          <p style={{ color: 'var(--tx-3)' }}>Loading user data…</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
        <TopBar title="User Not Found" subtitle="This user does not exist" />
        <div className="p-8">
          <Link href="/users" style={{ color: 'var(--tx-3)', fontSize: 13 }}>← Back to Users</Link>
        </div>
      </div>
    )
  }

  const initials = profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const trustScore = profile.trust_score ?? 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="User Profile" subtitle={`360° view — ${profile.full_name}`} />
      <div className="p-6 space-y-5">

        {/* Back */}
        <Link href="/users" className="text-[13px] font-medium" style={{ color: 'var(--tx-3)' }}>
          ← Back to Users
        </Link>

        {/* Hero card */}
        <div style={CARD} className="p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>{initials}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[20px] font-bold" style={{ color: 'var(--tx-1)' }}>{profile.full_name}</h1>
                <span style={{ backgroundColor: profile.type === 'candidate' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', color: profile.type === 'candidate' ? '#6366F1' : '#10B981', border: `1px solid ${profile.type === 'candidate' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                  {profile.type === 'candidate' ? 'CANDIDATE' : 'COMPANY'}
                </span>
                <Pill value={profile.status} />
                <Pill value={profile.verification_status} />
              </div>
              <p className="text-[13px] mt-1" style={{ color: 'var(--tx-3)' }}>{profile.email}</p>
              {profile.industry && <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{profile.industry}</p>}
              {profile.website && <p className="text-[12px] mt-0.5"><a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1' }}>{profile.website}</a></p>}
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--tx-3)' }}>Joined {formatDate(profile.created_at)}</p>
            </div>

            {/* Trust Score */}
            {profile.type === 'candidate' && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <svg viewBox="0 0 64 64" style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke={trustScore >= 70 ? '#34D399' : trustScore >= 40 ? '#FBBF24' : '#F87171'} strokeWidth="6" strokeDasharray={`${(trustScore / 100) * 163} 163`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{trustScore}</span>
                  </div>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--tx-3)' }}>Trust Score</p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {confirmAction ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: 'var(--tx-2)' }}>Confirm {confirmAction}?</span>
                <button onClick={() => doAction(confirmAction as 'suspend' | 'ban' | 'reactivate' | 'verify')} disabled={!!acting}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', backgroundColor: '#F87171', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {acting ? 'Working…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmAction(null)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {profile.status !== 'suspended' && <button onClick={() => setConfirmAction('suspend')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)', color: '#FBBF24', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Suspend</button>}
                {profile.status !== 'banned' && <button onClick={() => setConfirmAction('ban')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ban</button>}
                {(profile.status === 'suspended' || profile.status === 'banned') && <button onClick={() => setConfirmAction('reactivate')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)', color: '#34D399', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reactivate</button>}
                {profile.verification_status !== 'verified' && <button onClick={() => setConfirmAction('verify')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Verify</button>}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderBottom: tab === t.key ? '2px solid #6366F1' : '2px solid transparent', backgroundColor: 'transparent', color: tab === t.key ? '#6366F1' : 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366F1', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-4">
            <div style={CARD} className="p-5">
              <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--tx-2)' }}>Profile Details</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Email', value: profile.email },
                  { label: 'Status', value: <Pill value={profile.status} /> },
                  { label: 'Verification', value: <Pill value={profile.verification_status} /> },
                  { label: 'Joined', value: formatDate(profile.created_at) },
                  ...(profile.type === 'candidate' && profile.trust_score != null ? [{ label: 'Trust Score', value: `${profile.trust_score}/100` }] : []),
                  ...(profile.industry ? [{ label: 'Industry', value: profile.industry }] : []),
                  ...(profile.website ? [{ label: 'Website', value: profile.website }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[12px]" style={{ color: 'var(--tx-3)' }}>{row.label}</span>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--tx-1)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={CARD} className="p-5">
              <h3 className="text-[13px] font-bold mb-3" style={{ color: 'var(--tx-2)' }}>Activity Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Applications', count: applications.length, color: '#6366F1' },
                  { label: 'CVs', count: cvs.length, color: '#10B981' },
                  { label: 'Portfolio', count: portfolio.length, color: '#F59E0B' },
                  { label: 'Tickets', count: tickets.length, color: '#F87171' },
                  { label: 'Badges', count: badges.length, color: '#A78BFA' },
                  { label: 'Audit Events', count: audit.length, color: '#38BDF8' },
                ].map(s => (
                  <div key={s.label} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</p>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {profile.type === 'candidate' && profile.skills && profile.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map(s => (
                      <span key={s} style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366F1', borderRadius: 6, padding: '2px 8px', fontSize: 11, border: '1px solid rgba(99,102,241,0.2)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.experience && (
                <div className="mt-4">
                  <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--tx-3)' }}>Experience</p>
                  <p className="text-[12px]" style={{ color: 'var(--tx-2)' }}>{profile.experience}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'applications' && (
          <div style={CARD} className="overflow-hidden">
            {applications.length === 0 ? (
              <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No applications found</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Job Title', 'Status', 'Applied'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {applications.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx-1)' }}>{a.job_postings?.title ?? a.job_id.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}><Pill value={a.status} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'cvs' && (
          <div style={CARD} className="overflow-hidden">
            {cvs.length === 0 ? (
              <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No CVs found</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Title', 'Template', 'Active', 'Created'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cvs.map(cv => (
                    <tr key={cv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{cv.title}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{cv.template_id ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}><Pill value={cv.is_active ? 'active' : 'inactive'} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{formatDate(cv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="grid grid-cols-3 gap-4">
            {portfolio.length === 0 ? (
              <div style={{ ...CARD, gridColumn: 'span 3' }} className="p-12 text-center">
                <p style={{ color: 'var(--tx-3)' }}>No portfolio items</p>
              </div>
            ) : portfolio.map(item => (
              <div key={item.id} style={CARD} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-[13px] font-bold" style={{ color: 'var(--tx-1)' }}>{item.title}</h4>
                  {item.is_featured && <span style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>FEATURED</span>}
                </div>
                {item.description && <p className="text-[11px] mb-2" style={{ color: 'var(--tx-3)' }}>{item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}</p>}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--tx-3)', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>{tag}</span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] mt-2" style={{ color: 'var(--tx-3)' }}>{formatDate(item.created_at)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'tickets' && (
          <div style={CARD} className="overflow-hidden">
            {tickets.length === 0 ? (
              <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No tickets found</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Subject', 'Priority', 'Status', 'Created'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx-1)' }}>{t.subject}</td>
                      <td style={{ padding: '12px 16px' }}><Pill value={t.priority ?? 'normal'} /></td>
                      <td style={{ padding: '12px 16px' }}><Pill value={t.status} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'badges' && (
          <div className="grid grid-cols-3 gap-4">
            {badges.length === 0 ? (
              <div style={{ ...CARD, gridColumn: 'span 3' }} className="p-12 text-center">
                <p style={{ color: 'var(--tx-3)' }}>No badges found</p>
              </div>
            ) : badges.map(b => (
              <div key={b.id} style={CARD} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #A78BFA, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 14 }}>🏅</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: 'var(--tx-1)' }}>{b.role_held}</p>
                    <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{b.company_profiles?.company_name ?? 'Unknown Company'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{formatDate(b.issued_at)}</p>
                  {b.is_verified && <span style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>VERIFIED</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div style={CARD} className="overflow-hidden">
            {audit.length === 0 ? (
              <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No audit events for this user</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Event', 'Actor', 'Severity', 'Time'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-1)', fontFamily: 'monospace' }}>{entry.event}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{entry.actor_email ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}><Pill value={entry.severity} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{timeDiff(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
