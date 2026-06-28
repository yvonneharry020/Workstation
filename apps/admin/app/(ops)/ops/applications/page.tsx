'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'

interface Application {
  id: string
  candidate_id: string
  job_id: string
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  created_at: string
  updated_at: string | null
  notes: string | null
  job_postings: { title: string; company_id: string; location: string | null; type: string | null } | null
}

type StatusKey = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

const PIPELINE: { key: StatusKey; label: string; color: string; bg: string }[] = [
  { key: 'applied',   label: 'Applied',   color: '#818CF8', bg: 'rgba(99,102,241,0.1)' },
  { key: 'screening', label: 'Screening', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
  { key: 'interview', label: 'Interview', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  { key: 'offer',     label: 'Offer',     color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  { key: 'hired',     label: 'Hired',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  { key: 'rejected',  label: 'Rejected',  color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
]

const NEXT_STATUS: Record<StatusKey, StatusKey | null> = {
  applied: 'screening', screening: 'interview', interview: 'offer',
  offer: 'hired', hired: null, rejected: null,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

function StatusPill({ status }: { status: StatusKey }) {
  const p = PIPELINE.find(p => p.key === status)
  if (!p) return null
  return (
    <span style={{ color: p.color, backgroundColor: p.bg, border: `1px solid ${p.color}40`, borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', textTransform: 'capitalize' }}>
      {p.label}
    </span>
  )
}

export default function ApplicationsPage() {
  const supabase = createClient()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [noteEditing, setNoteEditing] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('job_applications')
      .select('*, job_postings(title, company_id, location, type)')
      .order('created_at', { ascending: false })
    setApps((data ?? []) as Application[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: StatusKey) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('job_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.application_${status}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'job_application',
      severity: status === 'rejected' ? 'warning' : 'info', app: 'admin_panel',
    })
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    setActing(null)
  }

  async function saveNote(id: string) {
    await supabase.from('job_applications').update({ notes: noteDraft }).eq('id', id)
    setApps(prev => prev.map(a => a.id === id ? { ...a, notes: noteDraft } : a))
    setNoteEditing(null)
  }

  async function bulkReject() {
    const ids = Array.from(selected)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('job_applications').update({ status: 'rejected', updated_at: new Date().toISOString() }).in('id', ids)
    await Promise.all(ids.map(id => supabase.from('audit_logs').insert({
      event: 'admin.application_bulk_rejected', actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'job_application', severity: 'warning', app: 'admin_panel',
    })))
    setApps(prev => prev.map(a => ids.includes(a.id) ? { ...a, status: 'rejected' as StatusKey } : a))
    setSelected(new Set())
    setBulkConfirm(false)
  }

  const filtered = apps.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search && !a.job_postings?.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = apps.length
  const active = apps.filter(a => a.status !== 'rejected').length
  const hired = apps.filter(a => a.status === 'hired').length
  const conversionRate = total > 0 ? ((hired / total) * 100).toFixed(1) : '0'

  // company aggregation
  const byCompany: Record<string, { company_id: string; jobs: Set<string>; appCount: number; hiredCount: number }> = {}
  for (const a of apps) {
    const cid = a.job_postings?.company_id ?? 'unknown'
    if (!byCompany[cid]) byCompany[cid] = { company_id: cid, jobs: new Set(), appCount: 0, hiredCount: 0 }
    if (a.job_id) byCompany[cid].jobs.add(a.job_id)
    byCompany[cid].appCount++
    if (a.status === 'hired') byCompany[cid].hiredCount++
  }
  const companySummary = Object.values(byCompany).sort((a, b) => b.appCount - a.appCount).slice(0, 10)

  const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Applications Pipeline" subtitle="ATS overview — track all candidate applications across jobs" />
      <div className="p-6 space-y-6">

        {/* Pipeline Funnel */}
        <div className="grid grid-cols-6 gap-3">
          {PIPELINE.map((p, idx) => {
            const cnt = apps.filter(a => a.status === p.key).length
            const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
            return (
              <div key={p.key} style={CARD} className="p-4 flex flex-col gap-2 cursor-pointer"
                onClick={() => setStatusFilter(statusFilter === p.key ? 'all' : p.key)}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{p.label}</span>
                  {idx < PIPELINE.length - 1 && <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>→</span>}
                </div>
                <p className="text-[24px] font-bold font-display" style={{ color: p.color }}>{cnt}</p>
                <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{pct}% of total</p>
                <div style={{ height: 3, borderRadius: 99, backgroundColor: 'var(--border)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: p.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Applications', value: total },
            { label: 'Active Pipelines', value: active },
            { label: 'Conversion Rate', value: `${conversionRate}%` },
            { label: 'Hired', value: hired },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
              <p className="text-[26px] font-bold font-display" style={{ color: 'var(--tx-1)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters + Bulk */}
        <div style={CARD} className="p-5 flex items-center gap-4 flex-wrap">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by job title…"
            style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', ...PIPELINE.map(p => p.key)] as (StatusKey | 'all')[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  border: `1px solid ${statusFilter === s ? '#F59E0B' : 'var(--border)'}`,
                  backgroundColor: statusFilter === s ? 'rgba(245,158,11,0.12)' : 'var(--bg-base)',
                  color: statusFilter === s ? '#F59E0B' : 'var(--tx-3)' }}>
                {s}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            bulkConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: '#F87171' }}>Reject {selected.size} applications?</span>
                <button onClick={bulkReject} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: '#F87171', color: '#fff', border: 'none', cursor: 'pointer' }}>Confirm</button>
                <button onClick={() => setBulkConfirm(false)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: 'var(--bg-base)', color: 'var(--tx-3)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setBulkConfirm(true)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                Reject {selected.size} selected
              </button>
            )
          )}
        </div>

        {/* Application Table */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Applications ({filtered.length})</p>
          </div>
          {loading ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>No applications found</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 text-left">
                    <input type="checkbox" onChange={e => {
                      if (e.target.checked) setSelected(new Set(filtered.map(a => a.id)))
                      else setSelected(new Set())
                    }} checked={selected.size === filtered.length && filtered.length > 0} />
                  </th>
                  {['Candidate', 'Job', 'Location', 'Type', 'Status', 'Applied', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const isActing = acting === a.id
                  const nextStatus = NEXT_STATUS[a.status]
                  return (
                    <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: isActing ? 0.6 : 1 }}>
                      <td className="px-5 py-3">
                        <input type="checkbox" checked={selected.has(a.id)}
                          onChange={e => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(a.id); else next.delete(a.id)
                            setSelected(next)
                          }} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/users/${a.candidate_id}`} style={{ color: '#F59E0B', textDecoration: 'none', fontFamily: 'monospace', fontSize: '12px' }}>
                          {a.candidate_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--tx-1)', maxWidth: 160 }}>
                        <span className="truncate block">{a.job_postings?.title ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--tx-2)' }}>{a.job_postings?.location ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--tx-2)' }}>{a.job_postings?.type ?? '—'}</td>
                      <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                      <td className="px-4 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDate(a.created_at)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--tx-3)' }}>{a.updated_at ? timeAgo(a.updated_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {nextStatus && (
                            <button onClick={() => updateStatus(a.id, nextStatus)} disabled={isActing}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              → {nextStatus}
                            </button>
                          )}
                          {a.status !== 'rejected' && (
                            <button onClick={() => updateStatus(a.id, 'rejected')} disabled={isActing}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', cursor: 'pointer' }}>
                              Reject
                            </button>
                          )}
                          <button onClick={() => { setNoteEditing(a.id); setNoteDraft(a.notes ?? '') }}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-3)', cursor: 'pointer' }}>
                            Note
                          </button>
                        </div>
                        {noteEditing === a.id && (
                          <div className="mt-2 flex gap-1">
                            <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                              className="text-[12px]"
                              style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', outline: 'none' }}
                              placeholder="Add note…" />
                            <button onClick={() => saveNote(a.id)} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: 'none', backgroundColor: '#F59E0B', color: '#fff', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setNoteEditing(null)} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', cursor: 'pointer' }}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Company Summary */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Applications by Company</p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company ID', 'Active Jobs', 'Applications', 'Hired', 'Conversion'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companySummary.map((c, i) => (
                <tr key={c.company_id} style={{ borderBottom: i < companySummary.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-5 py-3 font-mono text-[12px]" style={{ color: 'var(--tx-2)' }}>{c.company_id.slice(0, 8)}…</td>
                  <td className="px-5 py-3" style={{ color: 'var(--tx-1)' }}>{c.jobs.size}</td>
                  <td className="px-5 py-3" style={{ color: 'var(--tx-1)' }}>{c.appCount}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: '#22C55E' }}>{c.hiredCount}</td>
                  <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>
                    {c.appCount > 0 ? `${((c.hiredCount / c.appCount) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
