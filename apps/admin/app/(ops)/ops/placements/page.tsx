'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface Placement {
  id: string
  status: string
  updated_at: string
  job_postings: { title: string; company_id: string; salary_min: number | null; salary_max: number | null } | null
  candidates: { full_name: string; email: string } | null
}

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG') }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) }
function yyyymm(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function PlacementsPage() {
  const supabase = createClient()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [totalApps, setTotalApps] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [plRes, appRes] = await Promise.all([
      supabase.from('job_applications')
        .select('id, status, updated_at, job_postings(title, company_id, salary_min, salary_max), candidates(full_name, email)')
        .eq('status', 'hired')
        .order('updated_at', { ascending: false }),
      supabase.from('job_applications').select('*', { count: 'exact', head: true }),
    ])
    setPlacements((plRes.data ?? []) as unknown as Placement[])
    setTotalApps(appRes.count ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const now = new Date()
  const thisMonthKey = yyyymm(now)
  const thisQtrMonths = [0, 1, 2].map(i => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return yyyymm(d) })

  const thisMonth = placements.filter(p => p.updated_at.startsWith(thisMonthKey)).length
  const thisQtr = placements.filter(p => thisQtrMonths.some(m => p.updated_at.startsWith(m))).length

  const avgSalary = (() => {
    const withSalary = placements.filter(p => p.job_postings?.salary_min || p.job_postings?.salary_max)
    if (!withSalary.length) return 0
    const total = withSalary.reduce((s, p) => {
      const min = p.job_postings?.salary_min ?? 0
      const max = p.job_postings?.salary_max ?? min
      return s + (min + max) / 2
    }, 0)
    return Math.round(total / withSalary.length)
  })()

  const successRate = totalApps > 0 ? ((placements.length / totalApps) * 100).toFixed(1) : '0'

  // Monthly chart data (last 6 months)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { key: yyyymm(d), label: d.toLocaleDateString('en-NG', { month: 'short' }), count: 0 }
  })
  placements.forEach(p => {
    const key = p.updated_at.slice(0, 7)
    const m = months.find(x => x.key === key)
    if (m) m.count++
  })
  const maxCount = Math.max(...months.map(m => m.count), 1)

  const filtered = placements.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (p.candidates?.email ?? '').toLowerCase().includes(s) || (p.job_postings?.title ?? '').toLowerCase().includes(s)
  })

  function exportCSV() {
    const rows = [['Candidate', 'Email', 'Job Title', 'Company ID', 'Placed Date', 'Salary Min', 'Salary Max'].join(',')]
    filtered.forEach(p => rows.push([
      `"${p.candidates?.full_name ?? ''}"`, p.candidates?.email ?? '',
      `"${p.job_postings?.title ?? ''}"`, p.job_postings?.company_id?.slice(0, 8) ?? '',
      fmtDate(p.updated_at), p.job_postings?.salary_min ?? '', p.job_postings?.salary_max ?? '',
    ].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'placements.csv'; a.click()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Candidate Placements" subtitle="Track successful hires and placement outcomes" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total Placements', value: placements.length, color: '#34D399' },
            { label: 'This Month', value: thisMonth, color: '#38BDF8' },
            { label: 'This Quarter', value: thisQtr, color: '#A78BFA' },
            { label: 'Avg Salary', value: avgSalary ? fmt(avgSalary) : '—', color: '#F59E0B' },
            { label: 'Success Rate', value: `${successRate}%`, color: '#34D399' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[20px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Monthly chart */}
        <div style={CARD} className="p-6">
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 16 }}>Monthly Placements — Last 6 Months</h4>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 80 }}>
            {months.map(m => (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700 }}>{m.count || ''}</span>
                <div style={{ width: '100%', height: `${(m.count / maxCount) * 60}px`, minHeight: 4, backgroundColor: '#34D399', borderRadius: 4, opacity: m.count ? 1 : 0.2 }} />
                <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or job title…" style={{ flex: 1, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
          <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Export CSV</button>
        </div>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No placements found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Candidate', 'Email', 'Job Title', 'Company', 'Placed', 'Salary Range'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 600 }}>{p.candidates?.full_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)' }}>{p.candidates?.email ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tx-1)' }}>{p.job_postings?.title ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{(p.job_postings?.company_id ?? '—').slice(0, 8)}…</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#34D399', fontWeight: 600 }}>
                      {p.job_postings?.salary_min ? `${fmt(p.job_postings.salary_min)} – ${fmt(p.job_postings?.salary_max ?? p.job_postings.salary_min)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
