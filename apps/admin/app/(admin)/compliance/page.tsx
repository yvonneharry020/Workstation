'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

type RequestType = 'access' | 'deletion' | 'portability' | 'correction'
type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

interface DataRequest {
  id: string
  user_id: string
  email: string
  request_type: RequestType
  status: RequestStatus
  submitted_at: string
  resolved_at: string | null
  notes: string | null
}

const CHECKLIST_ITEMS = [
  { key: 'ndpr.privacy_policy_published', label: 'Privacy Policy published on platform' },
  { key: 'ndpr.cookie_consent', label: 'Cookie consent mechanism implemented' },
  { key: 'ndpr.data_retention_policy', label: 'Data retention policy documented and applied' },
  { key: 'ndpr.dpo_appointed', label: 'Data Protection Officer (DPO) appointed' },
  { key: 'ndpr.nitda_registered', label: 'Registered with NITDA as a data controller' },
  { key: 'ndpr.staff_training', label: 'Annual NDPR staff training completed' },
]

const STATUS_STYLE: Record<RequestStatus, { text: string; bg: string; border: string }> = {
  pending:     { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  in_progress: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)' },
  completed:   { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  rejected:    { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysBetween(a: string, b: string | null) {
  const end = b ? new Date(b) : new Date()
  return Math.round((end.getTime() - new Date(a).getTime()) / 86400000)
}

export default function CompliancePage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<DataRequest[]>([])
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})
  const [showReject, setShowReject] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [reqRes, cfgRes] = await Promise.all([
      supabase.from('data_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('platform_config').select('key,value').in('key', CHECKLIST_ITEMS.map(i => i.key)),
    ])
    setRequests((reqRes.data ?? []) as DataRequest[])
    const map: Record<string, boolean> = {}
    ;(cfgRes.data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value === 'true' })
    setChecklist(map)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function getActor() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async function updateStatus(req: DataRequest, status: RequestStatus, notes?: string) {
    setActing(req.id)
    const update: Partial<DataRequest> = { status }
    if (status === 'completed' || status === 'rejected') update.resolved_at = new Date().toISOString()
    if (notes) update.notes = notes
    await supabase.from('data_requests').update(update).eq('id', req.id)
    const user = await getActor()
    await supabase.from('audit_logs').insert({
      event: `admin.dsr_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: req.id,
      target_type: 'data_request',
      severity: status === 'rejected' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...update } : r))
    setShowReject(null)
    setActing(null)
  }

  async function toggleChecklist(key: string, checked: boolean) {
    await supabase.from('platform_config').upsert({ key, value: String(checked) }, { onConflict: 'key' })
    setChecklist(prev => ({ ...prev, [key]: checked }))
  }

  function exportCSV() {
    const rows = [['ID', 'Email', 'Type', 'Status', 'Submitted', 'Resolved', 'Notes'].join(',')]
    requests.forEach(r => rows.push([r.id, r.email, r.request_type, r.status, r.submitted_at, r.resolved_at ?? '', `"${r.notes ?? ''}"`].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ndpr-requests.csv'; a.click()
  }

  const pending = requests.filter(r => r.status === 'pending').length
  const completed = requests.filter(r => r.status === 'completed').length
  const completedWithTime = requests.filter(r => r.status === 'completed' && r.resolved_at)
  const avgDays = completedWithTime.length > 0
    ? Math.round(completedWithTime.reduce((s, r) => s + daysBetween(r.submitted_at, r.resolved_at), 0) / completedWithTime.length)
    : 0
  const score = Math.round((Object.values(checklist).filter(Boolean).length / CHECKLIST_ITEMS.length) * 100)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="NDPR Compliance" subtitle="Nigeria Data Protection Regulation — data subject requests and compliance status" />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Requests Pending', value: pending, color: '#FBBF24' },
            { label: 'Completed', value: completed, color: '#34D399' },
            { label: 'Avg Resolution (days)', value: avgDays, color: '#38BDF8' },
            { label: 'Compliance Score', value: `${score}%`, color: score >= 80 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[26px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* NDPR Checklist */}
        <div style={CARD} className="p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>NDPR Compliance Checklist</h3>
            <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} complete</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHECKLIST_ITEMS.map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist[item.key] ?? false}
                  onChange={e => void toggleChecklist(item.key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#34D399', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: checklist[item.key] ? 'var(--tx-1)' : 'var(--tx-2)', textDecoration: checklist[item.key] ? 'none' : 'none' }}>{item.label}</span>
                {checklist[item.key] && <span style={{ marginLeft: 'auto', color: '#34D399', fontSize: 11, fontWeight: 700 }}>✓ DONE</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Data Subject Requests */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>Data Subject Requests (DSR)</h3>
            <button onClick={exportCSV} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Export CSV</button>
          </div>
          <div style={{ ...CARD, overflow: 'hidden' }}>
            {loading ? (
              <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
            ) : requests.length === 0 ? (
              <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No data requests yet</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Email', 'Type', 'Status', 'Submitted', 'Days', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const ss = STATUS_STYLE[r.status]
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tx-1)' }}>{r.email}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)', textTransform: 'capitalize' }}>{r.request_type}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ color: ss.text, backgroundColor: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{r.status.replace('_', ' ')}</span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{fmtDate(r.submitted_at)}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: daysBetween(r.submitted_at, r.resolved_at) > 30 ? '#F87171' : 'var(--tx-3)' }}>{daysBetween(r.submitted_at, r.resolved_at)}d</td>
                        <td style={{ padding: '10px 16px' }}>
                          {showReject === r.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input value={rejectNotes[r.id] ?? ''} onChange={e => setRejectNotes(p => ({ ...p, [r.id]: e.target.value }))} placeholder="Rejection reason…" style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--tx-1)', fontSize: 11, outline: 'none', width: 150 }} />
                              <button onClick={() => void updateStatus(r, 'rejected', rejectNotes[r.id])} disabled={acting === r.id} style={{ padding: '3px 8px', borderRadius: 5, backgroundColor: '#F87171', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Confirm</button>
                              <button onClick={() => setShowReject(null)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 5 }}>
                              {r.status === 'pending' && <button onClick={() => void updateStatus(r, 'in_progress')} disabled={acting === r.id} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(56,189,248,0.4)', backgroundColor: 'rgba(56,189,248,0.08)', color: '#38BDF8', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Start</button>}
                              {(r.status === 'pending' || r.status === 'in_progress') && <button onClick={() => void updateStatus(r, 'completed')} disabled={acting === r.id} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)', color: '#34D399', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Complete</button>}
                              {r.status !== 'rejected' && r.status !== 'completed' && <button onClick={() => setShowReject(r.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Reject</button>}
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
        </div>
      </div>
    </div>
  )
}
