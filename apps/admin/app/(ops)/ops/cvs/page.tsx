'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface CV {
  id: string
  candidate_id: string
  title: string
  template_id: string | null
  is_active: boolean
  file_url: string | null
  created_at: string
  updated_at: string
}

type DateFilter = 'all' | '7d' | '30d'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CVManagementPage() {
  const supabase = createClient()
  const [cvs, setCvs] = useState<CV[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [viewCV, setViewCV] = useState<CV | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cv_versions')
      .select('*')
      .order('created_at', { ascending: false })
    setCvs((data ?? []) as CV[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function deactivateCV(cv: CV) {
    setActing(cv.id)
    await supabase.from('cv_versions').update({ is_active: false }).eq('id', cv.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.cv_deactivated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: cv.id,
      target_type: 'cv',
      severity: 'info',
      app: 'admin_panel',
    })
    setCvs(prev => prev.map(c => c.id === cv.id ? { ...c, is_active: false } : c))
    setActing(null)
  }

  async function flagCV(cv: CV) {
    setActing(`flag-${cv.id}`)
    await supabase.from('flagged_content').insert({
      content_type: 'cv',
      content_id: cv.id,
      reason: 'Admin flagged for review',
      severity: 'low',
      status: 'pending',
    })
    setActing(null)
    alert('CV flagged for review')
  }

  function exportCSV() {
    const rows = [['ID', 'Candidate ID', 'Title', 'Template', 'Active', 'Created'].join(',')]
    cvs.forEach(cv => rows.push([cv.id, cv.candidate_id, `"${cv.title}"`, cv.template_id ?? '', cv.is_active ? 'Yes' : 'No', cv.created_at].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'cv-export.csv'
    a.click()
  }

  const cutoff = dateFilter === '7d' ? Date.now() - 7 * 86400000 : dateFilter === '30d' ? Date.now() - 30 * 86400000 : 0
  const filtered = cvs.filter(cv => {
    if (search && !cv.candidate_id.includes(search) && !cv.title.toLowerCase().includes(search.toLowerCase())) return false
    if (activeFilter === 'active' && !cv.is_active) return false
    if (activeFilter === 'inactive' && cv.is_active) return false
    if (cutoff > 0 && new Date(cv.created_at).getTime() < cutoff) return false
    return true
  })

  const totalActive = cvs.filter(c => c.is_active).length
  const thisWeek = cvs.filter(c => new Date(c.created_at).getTime() > Date.now() - 7 * 86400000).length
  const candidateIds = new Set(cvs.map(c => c.candidate_id))
  const multiVersionUsers = cvs.reduce<Record<string, number>>((acc, c) => { acc[c.candidate_id] = (acc[c.candidate_id] ?? 0) + 1; return acc }, {})
  const multiCount = Object.values(multiVersionUsers).filter(n => n > 1).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="CV Management" subtitle="Review and moderate candidate CVs" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total CVs', value: cvs.length, color: '#F59E0B' },
            { label: 'Active CVs', value: totalActive, color: '#34D399' },
            { label: 'Added This Week', value: thisWeek, color: '#38BDF8' },
            { label: 'Multi-version Users', value: multiCount, color: '#A78BFA' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or candidate ID…"
            style={{ flex: 1, minWidth: 220, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}
          />
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${activeFilter === f ? '#F59E0B' : 'var(--border)'}`, backgroundColor: activeFilter === f ? 'rgba(245,158,11,0.1)' : 'transparent', color: activeFilter === f ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
          {(['all', '7d', '30d'] as const).map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${dateFilter === f ? '#38BDF8' : 'var(--border)'}`, backgroundColor: dateFilter === f ? 'rgba(56,189,248,0.1)' : 'transparent', color: dateFilter === f ? '#38BDF8' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {f === 'all' ? 'All Time' : f === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
          <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading CVs…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No CVs found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Title', 'Candidate ID', 'Template', 'Active', 'Created', 'Updated', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(cv => (
                  <tr key={cv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{cv.title}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{cv.candidate_id.slice(0, 8)}…</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{cv.template_id ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: cv.is_active ? '#34D399' : '#9CA3AF', backgroundColor: cv.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)', border: `1px solid ${cv.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.3)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        {cv.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(cv.created_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(cv.updated_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setViewCV(cv)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>View</button>
                        {cv.is_active && (
                          <button onClick={() => deactivateCV(cv)} disabled={acting === cv.id} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)', color: '#FBBF24', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            {acting === cv.id ? '…' : 'Deactivate'}
                          </button>
                        )}
                        <button onClick={() => flagCV(cv)} disabled={acting === `flag-${cv.id}`} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {acting === `flag-${cv.id}` ? '…' : 'Flag'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* View drawer */}
        {viewCV && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 400, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>CV Details</h3>
                <button onClick={() => setViewCV(null)} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              {[
                { label: 'Title', value: viewCV.title },
                { label: 'Candidate ID', value: viewCV.candidate_id },
                { label: 'Template', value: viewCV.template_id ?? 'None' },
                { label: 'Active', value: viewCV.is_active ? 'Yes' : 'No' },
                { label: 'File URL', value: viewCV.file_url ?? 'Not uploaded' },
                { label: 'Created', value: formatDate(viewCV.created_at) },
                { label: 'Updated', value: formatDate(viewCV.updated_at) },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)', wordBreak: 'break-all' }}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
