'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Users, Briefcase, TicketCheck, Flag, ShieldAlert,
  TrendingUp, ArrowUpRight, Building2, Clock, Award,
  ChevronRight, Activity,
} from 'lucide-react'

/* ─── Types ─── */
interface AuditEntry {
  id: string
  event: string
  created_at: string
  actor_email: string | null
  severity: string
}

interface DayPoint { date: string; registrations: number }

/* ─── Helpers ─── */
function timeDiff(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function buildDayRange(days: number): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), registrations: 0 }
  })
}

/* ─── Chart tooltip ─── */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-md)',
      }}
      className="rounded-xl px-3 py-2.5 text-[12px]"
    >
      <p className="font-semibold mb-1" style={{ color: 'var(--tx-2)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold text-[14px]" style={{ color: 'var(--tx-1)' }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  )
}

/* ─── KPI Card ─── */
interface KpiCardProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  trend?: { value: number; up: boolean }
  href?: string
  accent?: string
}

function KpiCard({ label, value, sub, icon, iconBg, iconColor, trend, href, accent }: KpiCardProps) {
  const inner = (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200 group cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = accent ?? 'var(--border-strong)'
        el.style.boxShadow = `var(--shadow-md), 0 0 0 1px ${accent ?? 'var(--border-strong)'}`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full
            ${trend.up ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
            <TrendingUp size={10} className={trend.up ? '' : 'rotate-180'} />
            {trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[28px] font-bold font-display leading-none tracking-tight"
          style={{ color: 'var(--tx-1)' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{sub}</p>}
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

/* ─── Support pill ─── */
function SupportPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <span className={`text-[22px] font-bold font-mono ${color}`}>{value}</span>
      <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{label}</span>
    </div>
  )
}

/* ─── Severity badge ─── */
const SEV: Record<string, string> = {
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  error:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  warning:  'text-amber-400 bg-amber-500/10 border-amber-500/25',
  info:     'text-sky-400 bg-sky-500/10 border-sky-500/25',
}

/* ─── Page ─── */
export default function DashboardPage() {
  const supabase = createClient()

  const [loading, setLoading]           = useState(true)
  const [totalCandidates, setTotalCand] = useState(0)
  const [totalCompanies,  setTotalComp] = useState(0)
  const [pendingCand,     setPendCand]  = useState(0)
  const [pendingComp,     setPendComp]  = useState(0)
  const [activeJobs,      setActiveJobs]= useState(0)
  const [flagged,         setFlagged]   = useState(0)
  const [disputes,        setDisputes]  = useState(0)
  const [todayReg,        setTodayReg]  = useState(0)
  const [newTickets,      setNewTickets]= useState(0)
  const [inProgress,      setInProg]    = useState(0)
  const [resolved,        setResolved]  = useState(0)
  const [assigned,        setAssigned]  = useState(0)
  const [unreadChats,     setUnread]    = useState(0)
  const [openChats,       setOpenChats] = useState(0)
  const [resolvedChats,   setResolvedC] = useState(0)
  const [activity,        setActivity]  = useState<AuditEntry[]>([])
  const [regChart,        setRegChart]  = useState<DayPoint[]>([])

  useEffect(() => { void load() }, [])

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()
    const fourteenAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()

    const results = await Promise.allSettled([
      supabase.from('candidates').select('*', { count: 'exact', head: true }),                                              // 0
      supabase.from('companies').select('*', { count: 'exact', head: true }),                                               // 1
      supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),        // 2
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),         // 3
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),                            // 4
      supabase.from('flagged_content').select('*', { count: 'exact', head: true }).eq('status', 'open'),                   // 5
      supabase.from('badge_disputes').select('*', { count: 'exact', head: true }).not('status', 'in', '("upheld","badge_removed")'), // 6
      supabase.from('candidates').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),                 // 7
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'sent'),                   // 8
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),            // 9
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),               // 10
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).not('assigned_to', 'is', null),         // 11
      supabase.from('chat_threads').select('unread_admin, status'),                                                         // 12
      supabase.from('audit_logs').select('id,event,created_at,actor_email,severity').order('created_at', { ascending: false }).limit(12), // 13
      supabase.from('candidates').select('created_at').gte('created_at', fourteenAgo),                                     // 14
    ])

    function cnt(i: number) {
      const r = results[i]; if (r.status === 'rejected') return 0
      return (r.value as { count: number | null }).count ?? 0
    }
    function rows<T>(i: number): T[] {
      const r = results[i]; if (r.status === 'rejected') return []
      return ((r.value as { data: T[] | null }).data ?? []) as T[]
    }

    const threads = rows<{ unread_admin: number; status: string }>(12)
    const recentCand = rows<{ created_at: string }>(14)

    /* Build 14-day registration chart */
    const pts = buildDayRange(14)
    for (const c of recentCand) {
      const day = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const found = pts.find(p => p.date === day)
      if (found) found.registrations++
    }

    setTotalCand(cnt(0)); setTotalComp(cnt(1)); setPendCand(cnt(2)); setPendComp(cnt(3))
    setActiveJobs(cnt(4)); setFlagged(cnt(5)); setDisputes(cnt(6)); setTodayReg(cnt(7))
    setNewTickets(cnt(8)); setInProg(cnt(9)); setResolved(cnt(10)); setAssigned(cnt(11))
    setUnread(threads.reduce((s, t) => s + (t.unread_admin ?? 0), 0))
    setOpenChats(threads.filter(t => t.status !== 'resolved').length)
    setResolvedC(threads.filter(t => t.status === 'resolved').length)
    setActivity(rows<AuditEntry>(13))
    setRegChart(pts)
    setLoading(false)
  }

  const pendingTotal = pendingCand + pendingComp

  const ticketBarData = [
    { name: 'New',         value: newTickets, color: '#F59E0B' },
    { name: 'In Progress', value: inProgress, color: '#6366F1' },
    { name: 'Assigned',    value: assigned,   color: '#06B6D4' },
    { name: 'Resolved',    value: resolved,   color: '#10B981' },
  ]

  const quickActions = [
    { href: '/users',          label: 'User Management',   count: null,        color: 'text-indigo-400' },
    { href: '/analytics',      label: 'Analytics',         count: null,        color: 'text-sky-400' },
    { href: '/staff',          label: 'Staff Members',     count: null,        color: 'text-violet-400' },
    { href: '/audit-log',      label: 'Audit Log',         count: null,        color: 'text-sky-400' },
    { href: '/notifications',  label: 'Send Notification', count: null,        color: 'text-emerald-400' },
    { href: '/system-config',  label: 'System Config',     count: null,        color: 'text-rose-400' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div
        className="px-8 py-6 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight"
              style={{ color: 'var(--tx-1)' }}>
              Executive Control Room
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              Platform-wide overview — health, growth, and operational status
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)' }}>
            <Activity size={12} />
            <span>Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-7 flex-1">

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Users"
            value={totalCandidates + totalCompanies}
            sub={`${totalCandidates.toLocaleString()} candidates · ${totalCompanies.toLocaleString()} companies`}
            icon={<Users size={18} />}
            iconBg="rgba(99,102,241,0.12)"
            iconColor="#818CF8"
            accent="rgba(99,102,241,0.4)"
            href="/users"
          />
          <KpiCard
            label="Active Jobs"
            value={activeJobs}
            sub="Live job listings on platform"
            icon={<Briefcase size={18} />}
            iconBg="rgba(6,182,212,0.12)"
            iconColor="#22D3EE"
            accent="rgba(6,182,212,0.4)"
          />
          <KpiCard
            label="Open Tickets"
            value={newTickets + inProgress}
            sub={`${newTickets} new · ${inProgress} in progress`}
            icon={<TicketCheck size={18} />}
            iconBg={newTickets > 5 ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)'}
            iconColor={newTickets > 5 ? '#FBBF24' : '#818CF8'}
            accent="rgba(245,158,11,0.4)"
            href="/ops/tickets"
          />
          <KpiCard
            label="Needs Review"
            value={pendingTotal + flagged}
            sub={`${pendingTotal} verifications · ${flagged} flagged`}
            icon={<ShieldAlert size={18} />}
            iconBg={pendingTotal + flagged > 5 ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)'}
            iconColor={pendingTotal + flagged > 5 ? '#F87171' : '#818CF8'}
            accent="rgba(239,68,68,0.4)"
            href="/verifications/candidates"
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-3 gap-5">
          {/* Registration trend */}
          <div
            className="col-span-2 rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                  Registration Trend
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                  New candidate sign-ups — last 14 days
                </p>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                <ArrowUpRight size={13} />
                {todayReg} today
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={regChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--tx-3)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  name="registrations"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#regGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#6366F1', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Ticket breakdown */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-5">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                Ticket Status
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                Support tickets by stage
              </p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ticketBarData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: 'var(--tx-3)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="value" name="tickets" radius={[6, 6, 0, 0]}>
                  {ticketBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Support Overview strip ── */}
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
              Support Overview
            </p>
            <Link href="/ops/dashboard"
              className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              Management Room <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-7 gap-2.5">
            <SupportPill label="Unread Chats"    value={unreadChats}   color={unreadChats > 0 ? 'text-rose-400' : 'text-indigo-400'} />
            <SupportPill label="Open Chats"      value={openChats}     color="text-amber-400" />
            <SupportPill label="Resolved Chats"  value={resolvedChats} color="text-emerald-400" />
            <SupportPill label="New Tickets"     value={newTickets}    color={newTickets > 0 ? 'text-amber-400' : 'text-indigo-400'} />
            <SupportPill label="In Progress"     value={inProgress}    color="text-sky-400" />
            <SupportPill label="Assigned"        value={assigned}      color="text-violet-400" />
            <SupportPill label="Resolved"        value={resolved}      color="text-emerald-400" />
          </div>
        </div>

        {/* ── Activity + Quick Actions ── */}
        <div className="grid grid-cols-3 gap-5">
          {/* Recent activity */}
          <div
            className="col-span-2 rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                Recent Activity
              </p>
              <Link href="/audit-log"
                className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--tx-3)' }}>
                No recent activity.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {activity.map(e => (
                  <li key={e.id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded-md font-mono flex-shrink-0
                        ${SEV[e.severity] ?? 'border-[var(--border)] text-[var(--tx-3)]'}`}
                    >
                      {e.severity}
                    </span>
                    <span className="text-[12px] font-mono flex-1 truncate" style={{ color: 'var(--tx-2)' }}>
                      {e.event}
                    </span>
                    <span className="text-[11px] flex-shrink-0 truncate max-w-[110px]" style={{ color: 'var(--tx-3)' }}>
                      {e.actor_email ?? 'system'}
                    </span>
                    <span className="text-[11px] flex-shrink-0 font-mono" style={{ color: 'var(--tx-3)' }}>
                      {timeDiff(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick actions */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="text-[14px] font-semibold mb-4" style={{ color: 'var(--tx-1)' }}>
              Quick Actions
            </p>
            <div className="space-y-1.5">
              {quickActions.map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl
                    border border-transparent transition-all duration-150 group"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border-strong)'
                    el.style.backgroundColor = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'transparent'
                    el.style.backgroundColor = 'var(--bg-elevated)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    {a.count !== null && (
                      <span className={`text-[15px] font-bold font-mono w-7 flex-shrink-0 ${a.color}`}>
                        {a.count}
                      </span>
                    )}
                    <span className="text-[13px] font-medium" style={{ color: 'var(--tx-1)' }}>
                      {a.label}
                    </span>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--tx-3)' }} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Secondary KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Registered Today"
            value={todayReg}
            sub="New candidates since midnight"
            icon={<TrendingUp size={18} />}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#34D399"
            accent="rgba(16,185,129,0.4)"
          />
          <KpiCard
            label="Pending Verification"
            value={pendingTotal}
            sub={`${pendingCand} candidates · ${pendingComp} companies`}
            icon={<Clock size={18} />}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#FBBF24"
            accent="rgba(245,158,11,0.4)"
            href="/verifications/candidates"
          />
          <KpiCard
            label="Total Companies"
            value={totalCompanies}
            sub="Active employers on platform"
            icon={<Building2 size={18} />}
            iconBg="rgba(6,182,212,0.12)"
            iconColor="#22D3EE"
            accent="rgba(6,182,212,0.4)"
          />
          <KpiCard
            label="Badge Disputes"
            value={disputes}
            sub="Open admin-created disputes"
            icon={<Award size={18} />}
            iconBg={disputes > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)'}
            iconColor={disputes > 0 ? '#F87171' : '#818CF8'}
            accent="rgba(239,68,68,0.4)"
            href="/disputes"
          />
        </div>

      </div>
    </div>
  )
}
