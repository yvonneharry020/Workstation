'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

interface InterviewBooking {
  id: string
  candidate_id: string
  company_id: string
  slot_id: string
  job_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  created_at: string
  notes: string | null
  interview_slots: { slot_date: string; start_time: string; end_time: string; company_id: string } | null
  job_postings: { title: string; company_id: string } | null
}

interface SlotSummary {
  company_id: string
  count: number
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
type DateFilter = 'today' | 'week' | 'month' | 'all'

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  pending:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.3)' },
  confirmed: { text: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
  completed: { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  cancelled: { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
  no_show:   { text: '#F87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function InterviewsPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<InterviewBooking[]>([])
  const [slots, setSlots] = useState<SlotSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const load = useCallback(async () => {
    const [{ data: bookData }, { data: slotData }] = await Promise.all([
      supabase
        .from('interview_bookings')
        .select('*, interview_slots(slot_date, start_time, end_time, company_id), job_postings(title, company_id)')
        .order('created_at', { ascending: false }),
      supabase
        .from('interview_slots')
        .select('company_id')
        .eq('is_available', true),
    ])
    setBookings((bookData ?? []) as InterviewBooking[])

    // summarise available slots per company
    const grouped: Record<string, number> = {}
    for (const s of slotData ?? []) {
      grouped[s.company_id] = (grouped[s.company_id] ?? 0) + 1
    }
    setSlots(Object.entries(grouped).map(([company_id, count]) => ({ company_id, count })))
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: InterviewBooking['status']) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('interview_bookings').update({ status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.interview_booking_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'interview_booking',
      severity: 'info',
      app: 'admin_panel',
    })
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    setActing(null)
  }

  // date filter
  const now = new Date()
  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (dateFilter === 'all') return true
    const created = new Date(b.created_at)
    if (dateFilter === 'today') {
      return created.toDateString() === now.toDateString()
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
      return created >= weekAgo
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)
      return created >= monthAgo
    }
    return true
  })

  const total = bookings.length
  const pending = bookings.filter(b => b.status === 'pending').length
  const confirmed = bookings.filter(b => b.status === 'confirmed').length
  const completed = bookings.filter(b => b.status === 'completed').length
  const noShow = bookings.filter(b => b.status === 'no_show').length
  const noShowDenom = confirmed + completed + noShow
  const noShowRate = noShowDenom > 0 ? Math.round((noShow / noShowDenom) * 100) : 0
  const noShowColor = noShowRate > 20 ? '#F87171' : noShowRate > 10 ? '#FBBF24' : '#34D399'

  const totalAvailableSlots = slots.reduce((a, s) => a + s.count, 0)

  const CARD = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-card)',
  }

  const STATUS_TABS: StatusFilter[] = ['all', 'pending', 'confirmed', 'completed', 'no_show', 'cancelled']
  const DATE_TABS: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' }, { key: 'all', label: 'All Time' },
  ]

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Interview Management" subtitle="Track and manage all interview bookings" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total Bookings', value: total, color: '#6366F1' },
            { label: 'Pending', value: pending, color: '#38BDF8' },
            { label: 'Confirmed', value: confirmed, color: '#34D399' },
            { label: 'Completed', value: completed, color: '#A78BFA' },
            { label: 'No-Show Rate', value: `${noShowRate}%`, color: noShowColor },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
              <p className="text-[28px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Slot Availability Banner */}
        {slots.length > 0 && (
          <div style={{ ...CARD, padding: '16px 20px', backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <p className="text-[13px]" style={{ color: 'var(--tx-2)' }}>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{slots.length} companies</span> have{' '}
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{totalAvailableSlots} available slots</span> waiting for candidates
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={CARD} className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--tx-3)' }}>Status</p>
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${statusFilter === s ? '#F59E0B' : 'var(--border)'}`,
                  backgroundColor: statusFilter === s ? 'rgba(245,158,11,0.12)' : 'var(--bg-base)',
                  color: statusFilter === s ? '#F59E0B' : 'var(--tx-3)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >{s.replace('_', ' ')}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--tx-3)' }}>Date</p>
            {DATE_TABS.map(d => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key)}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${dateFilter === d.key ? '#F59E0B' : 'var(--border)'}`,
                  backgroundColor: dateFilter === d.key ? 'rgba(245,158,11,0.12)' : 'var(--bg-base)',
                  color: dateFilter === d.key ? '#F59E0B' : 'var(--tx-3)',
                  cursor: 'pointer',
                }}
              >{d.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={CARD} className="overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
              Bookings ({filtered.length})
            </p>
          </div>
          {loading ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--tx-3)' }}>No bookings found</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Candidate ID', 'Job', 'Date', 'Time', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const slot = b.interview_slots
                  const isActing = acting === b.id
                  return (
                    <tr key={b.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: isActing ? 0.6 : 1 }}>
                      <td className="px-5 py-3 font-mono text-[12px]" style={{ color: 'var(--tx-2)' }}>{b.candidate_id.slice(0, 8)}…</td>
                      <td className="px-5 py-3" style={{ color: 'var(--tx-1)', maxWidth: 180 }}>
                        <span className="truncate block">{b.job_postings?.title ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>{slot?.slot_date ? fmt(slot.slot_date) : '—'}</td>
                      <td className="px-5 py-3 font-mono text-[12px]" style={{ color: 'var(--tx-2)' }}>
                        {slot ? `${slot.start_time?.slice(0,5)} – ${slot.end_time?.slice(0,5)}` : '—'}
                      </td>
                      <td className="px-5 py-3"><StatusPill status={b.status} /></td>
                      <td className="px-5 py-3" style={{ color: 'var(--tx-3)' }}>{timeAgo(b.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {b.status === 'pending' && (
                            <button onClick={() => updateStatus(b.id, 'confirmed')} disabled={isActing}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', cursor: 'pointer' }}>
                              Confirm
                            </button>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button onClick={() => updateStatus(b.id, 'cancelled')} disabled={isActing}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(156,163,175,0.4)', backgroundColor: 'rgba(156,163,175,0.1)', color: '#9CA3AF', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <>
                              <button onClick={() => updateStatus(b.id, 'completed')} disabled={isActing}
                                style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(167,139,250,0.4)', backgroundColor: 'rgba(167,139,250,0.1)', color: '#A78BFA', cursor: 'pointer' }}>
                                Complete
                              </button>
                              <button onClick={() => updateStatus(b.id, 'no_show')} disabled={isActing}
                                style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', cursor: 'pointer' }}>
                                No Show
                              </button>
                            </>
                          )}
                        </div>
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
  )
}
