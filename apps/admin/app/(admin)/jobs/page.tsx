'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface JobPosting {
  id: string
  title: string
  company_id: string
  company_name: string | null
  description: string | null
  status: string
  location: string | null
  employment_type: string | null
  created_at: string
  salary_min: number | null
  salary_max: number | null
  requirements: string | null
}

type TabFilter = 'draft' | 'active' | 'all' | 'closed'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const STATUS_PILL: Record<string, { text: string; bg: string; border: string }> = {
  pending:  { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  active:   { text: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
  rejected: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  expired:  { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
  closed:   { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
}

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  remote: 'Remote',
}

function StatusPill({ value }: { value: string }) {
  const s = STATUS_PILL[value] ?? STATUS_PILL['pending']
  return <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' }}>{value}</span>
}

function fmtNGN(amount: number | null) {
  if (!amount) return '—'
  return '₦' + amount.toLocaleString('en-NG')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function JobsModerationPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabFilter>('draft')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('job_postings')
      .select('id,title,company_id,description,status,location,employment_type,created_at,salary_min,salary_max,requirements,company_profiles(company_name)')
      .order('created_at', { ascending: false })
    if (!error) setJobs((data ?? []).map((j: Record<string, unknown>) => ({
      ...j,
      employment_type: j.employment_type as string | null,
      company_name: (j.company_profiles as { company_name: string } | null)?.company_name ?? null,
    })) as unknown as JobPosting[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateJobStatus(id: string, status: 'active' | 'closed') {
    setActing(id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('job_postings').update({ status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.job_posting_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'job_posting',
      severity: status === 'closed' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    setActing(null)
  }

  const filtered = jobs.filter(j => {
    const matchTab = tab === 'all' || j.status === tab
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const draftCount = jobs.filter(j => j.status === 'draft').length
  const activeCount = jobs.filter(j => j.status === 'active').length
  const closedCount = jobs.filter(j => j.status === 'closed' || j.status === 'paused').length
  const total = jobs.length

  const TABS: { key: TabFilter; label: string; count: number }[] = [
    { key: 'draft', label: 'Pending Review', count: draftCount },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'all', label: 'All', count: total },
    { key: 'closed', label: 'Suspended', count: closedCount },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar title="Job Moderation" subtitle={`${draftCount} pending review · ${activeCount} live jobs`} />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Pending Review', value: draftCount, color: '#FBBF24' },
            { label: 'Active / Live', value: activeCount, color: '#34D399' },
            { label: 'Suspended', value: closedCount, color: '#F87171' },
            { label: 'Total', value: total, color: 'var(--tx-1)' },
          ].map(stat => (
            <div key={stat.label} style={{ ...CARD_STYLE, padding: '20px 24px' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: stat.color, margin: 0, fontFamily: 'var(--font-display)' }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', transition: 'all 0.15s',
              backgroundColor: tab === t.key ? '#6366F1' : 'var(--bg-elevated)',
              color: tab === t.key ? '#fff' : 'var(--tx-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t.label}
              <span style={{ backgroundColor: tab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{t.count}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title..."
              style={{ paddingLeft: 32, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', width: 200 }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                {['Job Title', 'Type', 'Location', 'Salary Range', 'Posted', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '65%' }} /></td></tr>
              ))}
              {!loading && filtered.map(job => (
                <>
                  <tr key={job.id} style={{ borderBottom: expanded === job.id ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{job.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>{job.company_name ?? job.company_id.slice(0, 12) + '…'}</p>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {job.employment_type && (
                        <span style={{ fontSize: 11, backgroundColor: 'rgba(99,102,241,0.12)', color: '#818CF8', padding: '3px 8px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {TYPE_LABELS[job.employment_type] ?? job.employment_type}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{job.location ?? '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: '#34D399', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {job.salary_min || job.salary_max
                        ? `${fmtNGN(job.salary_min)} – ${fmtNGN(job.salary_max)}/mo`
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(job.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={job.status} /></td>
                    <td style={{ padding: '14px 20px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(job.status === 'draft' || job.status === 'closed') && (
                          <button onClick={() => updateJobStatus(job.id, 'active')} disabled={acting === job.id} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', opacity: acting === job.id ? 0.6 : 1 }}>Approve</button>
                        )}
                        {job.status === 'active' && (
                          <button onClick={() => updateJobStatus(job.id, 'closed')} disabled={acting === job.id} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', opacity: acting === job.id ? 0.6 : 1 }}>Suspend</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === job.id && (
                    <tr key={`${job.id}-expanded`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={7} style={{ padding: '16px 20px 20px 48px', backgroundColor: 'var(--bg-elevated)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                          {job.description && (
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Description</p>
                              <p style={{ fontSize: 12, color: 'var(--tx-2)', margin: 0, lineHeight: 1.6 }}>{job.description.slice(0, 300)}{job.description.length > 300 ? '…' : ''}</p>
                            </div>
                          )}
                          {job.requirements && (
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Requirements</p>
                              <p style={{ fontSize: 12, color: 'var(--tx-2)', margin: 0, lineHeight: 1.6 }}>{job.requirements.slice(0, 300)}{job.requirements.length > 300 ? '…' : ''}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No job postings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
