'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveTicket {
  id: string
  ticket_number: string
  subject: string
  priority: string
  status: string
  department: string | null
  created_at: string
  created_by_email: string | null
  first_responded_at: string | null
}

interface ResolvedTicket {
  id: string
  ticket_number: string
  subject: string
  priority: string
  department: string | null
  created_at: string
  resolved_at: string
  created_by_email: string | null
  resolved_by_email: string | null
}

interface ChatThread {
  id: string
  subject: string
  user_name: string
  user_email: string
  user_type: string
  status: string
  created_at: string
  first_admin_reply_at: string | null
  resolved_at: string | null
  resolved_by_email: string | null
  last_message_at: string
}

interface StaffChatStat {
  sender_email: string
  sender_name: string
  total_messages: number
  total_threads: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLA_TARGETS: Record<string, number> = {
  urgent: 2,
  high:   8,
  normal: 24,
  low:    72,
}

const DEPT_COLOR: Record<string, string> = {
  Management: 'bg-ops-500/15 text-ops-400 border-ops-500/30',
  Technical:  'bg-tech-500/15 text-tech-400 border-tech-500/30',
  Finance:    'bg-finance-500/15 text-finance-400 border-finance-500/30',
  Admin:      'bg-admin-500/15 text-admin-400 border-admin-500/30',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  normal: 'text-blue-400',
  low:    'text-text-muted',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursElapsed(from: string, to?: string) {
  return ((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 3_600_000
}

function fmt(hours: number) {
  if (hours < 1)  return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function stamp(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function shortEmail(email: string | null) {
  if (!email) return '—'
  return email.split('@')[0]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeptBadge({ dept }: { dept: string | null }) {
  if (!dept) return <span className="text-text-muted text-[10px]">—</span>
  return (
    <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded font-mono ${DEPT_COLOR[dept] ?? 'bg-surface-elevated text-text-muted border-surface-border'}`}>
      {dept}
    </span>
  )
}

function SlaBar({ pct, breached }: { pct: number; breached: boolean }) {
  const color = breached ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'active' | 'resolved' | 'chat' | 'staff'

export default function SLAMonitorPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(true)

  const [activeTickets, setActiveTickets]   = useState<ActiveTicket[]>([])
  const [resolvedTickets, setResolvedTickets] = useState<ResolvedTicket[]>([])
  const [chatThreads, setChatThreads]         = useState<ChatThread[]>([])
  const [staffChatStats, setStaffChatStats]   = useState<StaffChatStat[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [activeRes, resolvedRes, chatRes, chatMsgRes] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id,ticket_number,subject,priority,status,department,created_at,created_by_email,first_responded_at')
        .not('status', 'in', '("resolved","closed")')
        .order('created_at', { ascending: true }),

      supabase
        .from('support_tickets')
        .select('id,ticket_number,subject,priority,department,created_at,resolved_at,created_by_email,resolved_by_email')
        .eq('status', 'resolved')
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(60),

      supabase
        .from('chat_threads')
        .select('id,subject,user_name,user_email,user_type,status,created_at,first_admin_reply_at,resolved_at,resolved_by_email,last_message_at')
        .order('created_at', { ascending: false })
        .limit(80),

      supabase
        .from('chat_messages')
        .select('sender_email,sender_name,thread_id')
        .eq('sender_type', 'admin')
        .not('sender_email', 'is', null),
    ])

    setActiveTickets((activeRes.data ?? []) as ActiveTicket[])
    setResolvedTickets((resolvedRes.data ?? []) as ResolvedTicket[])
    setChatThreads((chatRes.data ?? []) as ChatThread[])

    // Aggregate chat stats per staff
    const msgs = (chatMsgRes.data ?? []) as { sender_email: string; sender_name: string; thread_id: string }[]
    const byEmail = new Map<string, StaffChatStat>()
    for (const m of msgs) {
      if (!m.sender_email) continue
      const existing = byEmail.get(m.sender_email)
      if (!existing) {
        byEmail.set(m.sender_email, { sender_email: m.sender_email, sender_name: m.sender_name, total_messages: 1, total_threads: 1 })
      } else {
        existing.total_messages += 1
      }
    }
    // Count unique threads per staff
    const threadsByStaff = new Map<string, Set<string>>()
    for (const m of msgs) {
      if (!m.sender_email) continue
      if (!threadsByStaff.has(m.sender_email)) threadsByStaff.set(m.sender_email, new Set())
      threadsByStaff.get(m.sender_email)!.add(m.thread_id)
    }
    for (const [email, threads] of threadsByStaff) {
      const stat = byEmail.get(email)
      if (stat) stat.total_threads = threads.size
    }
    setStaffChatStats(Array.from(byEmail.values()).sort((a, b) => b.total_messages - a.total_messages))

    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  // ── Active ticket enrichment
  const enriched = activeTickets.map(t => {
    const elapsed = hoursElapsed(t.created_at)
    const target  = SLA_TARGETS[t.priority] ?? 24
    const breached = elapsed > target
    const pct = Math.min(120, Math.round((elapsed / target) * 100))
    const responseTime = t.first_responded_at ? hoursElapsed(t.created_at, t.first_responded_at) : null
    return { ...t, elapsed, target, breached, pct, responseTime }
  })
  const breached = enriched.filter(t => t.breached)
  const atRisk   = enriched.filter(t => !t.breached && t.pct >= 75)
  const healthy  = enriched.filter(t => !t.breached && t.pct < 75)

  // ── Resolved ticket enrichment
  const resolvedEnriched = resolvedTickets.map(t => {
    const resolutionHours = hoursElapsed(t.created_at, t.resolved_at)
    const target = SLA_TARGETS[t.priority] ?? 24
    const withinSla = resolutionHours <= target
    return { ...t, resolutionHours, target, withinSla }
  })
  const avgResolutionHours = resolvedEnriched.length > 0
    ? resolvedEnriched.reduce((s, t) => s + t.resolutionHours, 0) / resolvedEnriched.length
    : 0

  // ── Chat enrichment
  const chatEnriched = chatThreads.map(t => {
    const responseTimeHours = t.first_admin_reply_at
      ? hoursElapsed(t.created_at, t.first_admin_reply_at)
      : null
    const resolutionHours = t.resolved_at
      ? hoursElapsed(t.created_at, t.resolved_at)
      : null
    const unanswered = !t.first_admin_reply_at && t.status !== 'resolved'
    return { ...t, responseTimeHours, resolutionHours, unanswered }
  })
  const respondedChats = chatEnriched.filter(t => t.responseTimeHours !== null)
  const avgChatResponse = respondedChats.length > 0
    ? respondedChats.reduce((s, t) => s + t.responseTimeHours!, 0) / respondedChats.length
    : 0
  const unansweredChats = chatEnriched.filter(t => t.unanswered)

  // ── Summary cards
  const summaryCards = [
    { label: 'SLA Breached',      value: breached.length,                color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/30' },
    { label: 'At Risk',           value: atRisk.length,                  color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/30' },
    { label: 'Healthy Tickets',   value: healthy.length,                 color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/30' },
    { label: 'Avg Resolution',    value: fmt(avgResolutionHours),        color: 'text-text-primary', bg: 'bg-surface-card border-surface-border' },
    { label: 'Avg Chat Response', value: fmt(avgChatResponse),           color: 'text-ops-400',    bg: 'bg-surface-card border-surface-border' },
    { label: 'Unanswered Chats',  value: unansweredChats.length,         color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/30' },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active',   label: `Active (${enriched.length})` },
    { key: 'resolved', label: `Resolved (${resolvedEnriched.length})` },
    { key: 'chat',     label: `Live Chat (${chatThreads.length})` },
    { key: 'staff',    label: `Staff (${staffChatStats.length})` },
  ]

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="SLA Monitor"
        subtitle="Full ticket and chat lifecycle tracking"
      />

      {/* Summary row */}
      <div className="px-8 py-4 border-b border-surface-border flex flex-wrap gap-3">
        {summaryCards.map(s => (
          <div key={s.label} className={`border rounded-xl px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-8 py-3 border-b border-surface-border flex gap-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-ops-500 text-white'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary border border-surface-border'
            }`}>
            {t.label}
          </button>
        ))}
        <button onClick={() => void load()}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary transition-colors">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : (
          <>
            {/* ── Active Tickets ── */}
            {tab === 'active' && (
              <div className="space-y-6 max-w-4xl">
                {enriched.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-text-muted text-sm">No open tickets — SLA clear!</p>
                  </div>
                )}

                {breached.length > 0 && (
                  <section>
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">SLA Breached ({breached.length})</p>
                    <div className="space-y-2">
                      {breached.map(t => (
                        <div key={t.id} className="bg-red-900/10 border border-red-800/20 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-[10px] font-mono text-text-muted">{t.ticket_number}</span>
                                <DeptBadge dept={t.department} />
                                <span className={`text-[10px] font-semibold capitalize ${PRIORITY_COLOR[t.priority] ?? ''}`}>{t.priority}</span>
                              </div>
                              <p className="text-sm font-semibold text-text-primary truncate">{t.subject}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-[11px] text-text-muted">Created {stamp(t.created_at)}</span>
                                {t.created_by_email && <span className="text-[11px] text-text-muted">by <span className="text-text-secondary font-medium">{shortEmail(t.created_by_email)}</span></span>}
                                {t.responseTime !== null
                                  ? <span className="text-[11px] text-green-400">First response: {fmt(t.responseTime)}</span>
                                  : <span className="text-[11px] text-red-400">No response yet</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-red-400">{fmt(t.elapsed)} elapsed</p>
                              <p className="text-xs text-text-muted">Target: {t.target}h</p>
                            </div>
                          </div>
                          <SlaBar pct={t.pct} breached />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {atRisk.length > 0 && (
                  <section>
                    <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">At Risk — {'>'}75% SLA used ({atRisk.length})</p>
                    <div className="space-y-2">
                      {atRisk.map(t => (
                        <div key={t.id} className="bg-yellow-900/10 border border-yellow-800/20 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-[10px] font-mono text-text-muted">{t.ticket_number}</span>
                                <DeptBadge dept={t.department} />
                                <span className={`text-[10px] font-semibold capitalize ${PRIORITY_COLOR[t.priority] ?? ''}`}>{t.priority}</span>
                              </div>
                              <p className="text-sm font-semibold text-text-primary truncate">{t.subject}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-[11px] text-text-muted">Created {stamp(t.created_at)}</span>
                                {t.created_by_email && <span className="text-[11px] text-text-muted">by <span className="text-text-secondary font-medium">{shortEmail(t.created_by_email)}</span></span>}
                                {t.responseTime !== null
                                  ? <span className="text-[11px] text-green-400">First response: {fmt(t.responseTime)}</span>
                                  : <span className="text-[11px] text-yellow-400">Awaiting first response</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-yellow-400">{fmt(t.elapsed)} / {t.target}h</p>
                              <p className="text-xs text-text-muted">{t.pct}% used</p>
                            </div>
                          </div>
                          <SlaBar pct={t.pct} breached={false} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {healthy.length > 0 && (
                  <section>
                    <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Healthy ({healthy.length})</p>
                    <div className="space-y-2">
                      {healthy.map(t => (
                        <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-[10px] font-mono text-text-muted">{t.ticket_number}</span>
                                <DeptBadge dept={t.department} />
                                <span className={`text-[10px] font-semibold capitalize ${PRIORITY_COLOR[t.priority] ?? ''}`}>{t.priority}</span>
                              </div>
                              <p className="text-sm font-semibold text-text-primary truncate">{t.subject}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-[11px] text-text-muted">Created {stamp(t.created_at)}</span>
                                {t.created_by_email && <span className="text-[11px] text-text-muted">by <span className="text-text-secondary font-medium">{shortEmail(t.created_by_email)}</span></span>}
                                {t.responseTime !== null
                                  ? <span className="text-[11px] text-green-400">First response: {fmt(t.responseTime)}</span>
                                  : <span className="text-[11px] text-text-muted">No response yet</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-text-primary">{fmt(t.elapsed)} / {t.target}h</p>
                              <p className="text-xs text-text-muted">{t.pct}% used</p>
                            </div>
                          </div>
                          <SlaBar pct={t.pct} breached={false} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Resolved Tickets ── */}
            {tab === 'resolved' && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex gap-4 flex-wrap mb-2">
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-text-primary">{resolvedEnriched.length}</p>
                    <p className="text-[11px] text-text-muted">Tickets resolved</p>
                  </div>
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-text-primary">{fmt(avgResolutionHours)}</p>
                    <p className="text-[11px] text-text-muted">Avg resolution time</p>
                  </div>
                  <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-green-400">{resolvedEnriched.filter(t => t.withinSla).length}</p>
                    <p className="text-[11px] text-text-muted">Within SLA</p>
                  </div>
                  <div className="bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-red-400">{resolvedEnriched.filter(t => !t.withinSla).length}</p>
                    <p className="text-[11px] text-text-muted">Breached SLA</p>
                  </div>
                </div>

                {resolvedEnriched.length === 0
                  ? <p className="text-text-muted text-sm">No resolved tickets yet.</p>
                  : resolvedEnriched.map(t => (
                    <div key={t.id} className={`border rounded-xl p-4 ${t.withinSla ? 'bg-surface-card border-surface-border' : 'bg-red-900/10 border-red-800/20'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-[10px] font-mono text-text-muted">{t.ticket_number}</span>
                            <DeptBadge dept={t.department} />
                            <span className={`text-[10px] font-semibold capitalize ${PRIORITY_COLOR[t.priority] ?? ''}`}>{t.priority}</span>
                            {t.withinSla
                              ? <span className="text-[9px] font-bold uppercase bg-green-900/20 text-green-400 border border-green-800/30 px-1.5 py-0.5 rounded">Within SLA</span>
                              : <span className="text-[9px] font-bold uppercase bg-red-900/20 text-red-400 border border-red-800/30 px-1.5 py-0.5 rounded">SLA Breached</span>}
                          </div>
                          <p className="text-sm font-semibold text-text-primary truncate">{t.subject}</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1.5">
                            <span className="text-[11px] text-text-muted">Created: <span className="text-text-secondary">{stamp(t.created_at)}</span></span>
                            <span className="text-[11px] text-text-muted">Resolved: <span className="text-text-secondary">{stamp(t.resolved_at)}</span></span>
                            <span className="text-[11px] text-text-muted">By: <span className="text-text-secondary font-medium">{shortEmail(t.created_by_email)}</span></span>
                            <span className="text-[11px] text-text-muted">By: <span className="text-text-secondary font-medium">{shortEmail(t.resolved_by_email)}</span></span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${t.withinSla ? 'text-green-400' : 'text-red-400'}`}>{fmt(t.resolutionHours)}</p>
                          <p className="text-[11px] text-text-muted">Target: {t.target}h</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* ── Live Chat SLA ── */}
            {tab === 'chat' && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex gap-4 flex-wrap mb-2">
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-text-primary">{chatThreads.length}</p>
                    <p className="text-[11px] text-text-muted">Total conversations</p>
                  </div>
                  <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-ops-400">{fmt(avgChatResponse)}</p>
                    <p className="text-[11px] text-text-muted">Avg first response</p>
                  </div>
                  <div className="bg-orange-900/20 border border-orange-800/30 rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-orange-400">{unansweredChats.length}</p>
                    <p className="text-[11px] text-text-muted">Unanswered</p>
                  </div>
                  <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3">
                    <p className="text-xl font-bold font-display text-green-400">{chatThreads.filter(t => t.status === 'resolved').length}</p>
                    <p className="text-[11px] text-text-muted">Resolved</p>
                  </div>
                </div>

                {unansweredChats.length > 0 && (
                  <section className="mb-4">
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Unanswered — needs first reply ({unansweredChats.length})</p>
                    <div className="space-y-2">
                      {unansweredChats.map(t => (
                        <div key={t.id} className="bg-orange-900/10 border border-orange-800/20 rounded-xl p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{t.subject}</p>
                              <p className="text-[11px] text-text-muted mt-0.5">{t.user_name} · {t.user_email} · <span className="capitalize">{t.user_type}</span></p>
                              <p className="text-[11px] text-text-muted">Opened {stamp(t.created_at)}</p>
                            </div>
                            <p className="text-xs font-bold text-orange-400 flex-shrink-0">{fmt(hoursElapsed(t.created_at))} waiting</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">All Conversations</p>
                {chatEnriched.map(t => (
                  <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded ${
                            t.status === 'resolved' ? 'bg-trust-high-bg text-trust-high border-trust-high-border' :
                            t.status === 'in_progress' ? 'bg-trust-mid-bg text-trust-mid border-trust-mid-border' :
                            'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>{t.status.replace('_', ' ')}</span>
                          <span className="text-[10px] text-text-muted capitalize">{t.user_type}</span>
                        </div>
                        <p className="text-sm font-semibold text-text-primary truncate">{t.subject}</p>
                        <p className="text-[11px] text-text-muted">{t.user_name} · {t.user_email}</p>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          <span className="text-[11px] text-text-muted">Opened: {stamp(t.created_at)}</span>
                          <span className="text-[11px] text-text-muted">
                            First reply: {t.responseTimeHours !== null
                              ? <span className="text-green-400 font-medium">{fmt(t.responseTimeHours)}</span>
                              : <span className="text-orange-400 font-medium">None yet</span>}
                          </span>
                          {t.resolved_by_email && (
                            <span className="text-[11px] text-text-muted">Resolved by: <span className="text-text-secondary font-medium">{shortEmail(t.resolved_by_email)}</span></span>
                          )}
                          {t.resolutionHours !== null && (
                            <span className="text-[11px] text-text-muted">Total: <span className="text-text-secondary">{fmt(t.resolutionHours)}</span></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Staff Performance ── */}
            {tab === 'staff' && (
              <div className="space-y-4 max-w-3xl">
                <p className="text-xs text-text-muted mb-4">Based on chat messages sent. Ticket resolution stats populate as staff resolve tickets.</p>

                {/* Per-staff resolved ticket stats */}
                {(() => {
                  const byEmail = new Map<string, { email: string; resolved: number; totalHours: number }>()
                  for (const t of resolvedEnriched) {
                    if (!t.resolved_by_email) continue
                    const existing = byEmail.get(t.resolved_by_email)
                    if (!existing) byEmail.set(t.resolved_by_email, { email: t.resolved_by_email, resolved: 1, totalHours: t.resolutionHours })
                    else { existing.resolved += 1; existing.totalHours += t.resolutionHours }
                  }
                  const staffTicketStats = Array.from(byEmail.values()).sort((a, b) => b.resolved - a.resolved)
                  return staffTicketStats.length > 0 ? (
                    <section>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Ticket Resolutions per Staff</p>
                      <div className="space-y-2">
                        {staffTicketStats.map(s => (
                          <div key={s.email} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{shortEmail(s.email)}</p>
                              <p className="text-[11px] text-text-muted">{s.email}</p>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-lg font-bold font-display text-green-400">{s.resolved}</p>
                                <p className="text-[11px] text-text-muted">Resolved</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold font-display text-text-primary">{fmt(s.totalHours / s.resolved)}</p>
                                <p className="text-[11px] text-text-muted">Avg time</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null
                })()}

                {/* Per-staff chat stats */}
                {staffChatStats.length > 0 && (
                  <section>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Chat Activity per Staff</p>
                    <div className="space-y-2">
                      {staffChatStats.map(s => (
                        <div key={s.sender_email} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{s.sender_name}</p>
                            <p className="text-[11px] text-text-muted">{s.sender_email}</p>
                          </div>
                          <div className="flex gap-6 text-right">
                            <div>
                              <p className="text-lg font-bold font-display text-ops-400">{s.total_messages}</p>
                              <p className="text-[11px] text-text-muted">Messages sent</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold font-display text-text-primary">{s.total_threads}</p>
                              <p className="text-[11px] text-text-muted">Conversations</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {staffChatStats.length === 0 && resolvedTickets.length === 0 && (
                  <p className="text-text-muted text-sm">Staff stats will appear here once staff start replying to chats and resolving tickets.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
