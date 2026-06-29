'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ShieldCheck, TicketCheck, MessageSquare, Briefcase,
  ArrowRight, TrendingUp, Clock, CheckCircle, AlertTriangle,
  Activity, ChevronRight,
} from 'lucide-react'

interface Stats {
  pendingVerifications: number
  openTickets: number
  unreadChats: number
  pendingJobs: number
  resolvedTickets: number
  inProgressTickets: number
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
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
      <p className="font-semibold mb-0.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
      <p className="font-bold text-[14px] text-amber-400">{payload[0].value} items</p>
    </div>
  )
}

function buildRange(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), items: 0 }
  })
}

interface StatCardProps {
  label: string
  value: number
  sub: string
  icon: React.ReactNode
  href: string
  urgent?: boolean
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, sub, icon, href, urgent, iconBg, iconColor }: StatCardProps) {
  return (
    <Link
      href={href}
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${urgent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(245,158,11,0.5)'
        el.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = urgent ? 'rgba(245,158,11,0.3)' : 'var(--border)'
        el.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--tx-3)' }}
          className="group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div>
        <p className="text-[28px] font-bold font-display leading-none tracking-tight"
          style={{ color: urgent ? '#FBBF24' : 'var(--tx-1)' }}>
          {value}
        </p>
        <p className="text-[12px] font-semibold mt-1.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{sub}</p>
      </div>
    </Link>
  )
}

export default function OpsDashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({
    pendingVerifications: 0, openTickets: 0, unreadChats: 0,
    pendingJobs: 0, resolvedTickets: 0, inProgressTickets: 0,
  })
  const [loading, setLoading] = useState(true)
  const [ticketTrend, setTicketTrend] = useState(buildRange(10))

  useEffect(() => { void load() }, [])

  async function load() {
    const [
      { count: candCount },
      { count: compCount },
      { count: ticketNew },
      { count: ticketProg },
      { count: ticketRes },
      { count: jobCount },
      { data: chatData },
      { data: ticketDates },
    ] = await Promise.all([
      supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('chat_threads').select('unread_admin').gt('unread_admin', 0),
      supabase.from('support_tickets').select('created_at')
        .gte('created_at', new Date(Date.now() - 10 * 86_400_000).toISOString()),
    ])

    const pts = buildRange(10)
    for (const t of ticketDates ?? []) {
      const day = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const found = pts.find(p => p.date === day)
      if (found) found.items++
    }
    setTicketTrend(pts)

    setStats({
      pendingVerifications: (candCount ?? 0) + (compCount ?? 0),
      openTickets: (ticketNew ?? 0) + (ticketProg ?? 0),
      unreadChats: (chatData ?? []).reduce((s: number, t: { unread_admin: number }) => s + (t.unread_admin ?? 0), 0),
      pendingJobs: jobCount ?? 0,
      resolvedTickets: ticketRes ?? 0,
      inProgressTickets: ticketProg ?? 0,
    })
    setLoading(false)
  }

  const quickActions = [
    { label: 'Live Chat',          href: '/ops/chat',          desc: 'Reply to user messages',     Icon: MessageSquare },
    { label: 'Support Tickets',    href: '/ops/tickets',       desc: 'Manage open tickets',        Icon: TicketCheck },
    { label: 'Escalation Queue',   href: '/ops/escalations',   desc: 'Handle raised issues',       Icon: AlertTriangle },
    { label: 'Verification Queue', href: '/ops/verifications', desc: 'Review pending users',       Icon: ShieldCheck },
    { label: 'SLA Monitor',        href: '/ops/sla-monitor',   desc: 'Check response times',       Icon: Clock },
    { label: 'Badge Management',   href: '/ops/badges',        desc: 'Issue or revoke badges',     Icon: CheckCircle },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="px-8 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
              Management Dashboard
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              Operations overview — verifications, support, moderation & trust
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)' }}>
            <Activity size={12} />
            <span>Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6 flex-1">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Verifications"
            value={stats.pendingVerifications}
            sub="Candidates + companies"
            icon={<ShieldCheck size={18} />}
            href="/ops/verifications"
            urgent={stats.pendingVerifications > 10}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#FBBF24"
          />
          <StatCard
            label="Open Tickets"
            value={stats.openTickets}
            sub={`${stats.inProgressTickets} in progress`}
            icon={<TicketCheck size={18} />}
            href="/ops/tickets"
            urgent={stats.openTickets > 5}
            iconBg="rgba(99,102,241,0.12)"
            iconColor="#818CF8"
          />
          <StatCard
            label="Unread Chats"
            value={stats.unreadChats}
            sub="Messages needing response"
            icon={<MessageSquare size={18} />}
            href="/ops/chat"
            urgent={stats.unreadChats > 3}
            iconBg="rgba(6,182,212,0.12)"
            iconColor="#22D3EE"
          />
          <StatCard
            label="Pending Job Posts"
            value={stats.pendingJobs}
            sub="Jobs awaiting review"
            icon={<Briefcase size={18} />}
            href="/ops/jobs"
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#34D399"
          />
        </div>

        {/* Chart + Resolved stat */}
        <div className="grid grid-cols-3 gap-5">
          <div
            className="col-span-2 rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Ticket Volume</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>Tickets created — last 10 days</p>
              </div>
              <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                <TrendingUp size={12} />{stats.resolvedTickets} resolved total
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={ticketTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="opsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--tx-3)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false} axisLine={false} interval={1} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="items" stroke="#F59E0B" strokeWidth={2}
                  fill="url(#opsGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#F59E0B', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { label: 'Resolved Tickets', value: stats.resolvedTickets,    color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)' },
              { label: 'In Progress',      value: stats.inProgressTickets,  color: 'text-amber-400',  bg: 'rgba(245,158,11,0.1)' },
              { label: 'Pending Job Posts', value: stats.pendingJobs,       color: 'text-cyan-400',   bg: 'rgba(6,182,212,0.1)' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 flex-1 flex flex-col justify-between"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
                <p className={`text-[32px] font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick access grid */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-[14px] font-semibold mb-4" style={{ color: 'var(--tx-1)' }}>Quick Access</p>
          <div className="grid grid-cols-3 gap-2.5">
            {quickActions.map(qa => (
              <Link
                key={qa.href}
                href={qa.href}
                className="flex items-center justify-between px-4 py-3 rounded-xl border
                  border-transparent transition-all duration-150 group"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(245,158,11,0.35)'
                  el.style.backgroundColor = 'rgba(245,158,11,0.05)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'transparent'
                  el.style.backgroundColor = 'var(--bg-elevated)'
                }}
              >
                <div className="flex items-center gap-3">
                  <qa.Icon size={14} className="text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--tx-1)' }}>{qa.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--tx-3)' }}>{qa.desc}</p>
                  </div>
                </div>
                <ChevronRight size={12} style={{ color: 'var(--tx-3)' }} />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
