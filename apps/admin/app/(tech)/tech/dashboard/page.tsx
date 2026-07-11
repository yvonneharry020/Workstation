'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  AlertTriangle, ZapOff, Flag, CheckCircle2, Terminal,
  Database, Shield, Zap, ChevronRight, Activity, Code2,
} from 'lucide-react'

interface Incident {
  id: string; title: string; severity: string; status: string
  created_at: string; type: string
}

interface AuditEntry {
  id: string; event: string; severity: string; created_at: string; actor_email: string | null
}

interface Stats { openIncidents: number; criticalErrors: number; flaggedFlags: number }

const SEVERITY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  error:    { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)' },
  warning:  { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  medium:   { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  low:      { text: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
  info:     { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
}

const STATUS_DOT: Record<string, string> = {
  open:          '#EF4444',
  investigating: '#F97316',
  identified:    '#FBBF24',
  monitoring:    '#38BDF8',
  resolved:      '#22C55E',
}

function timeDiff(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-md)' }}
      className="rounded-xl px-3 py-2.5 text-[12px]">
      <p className="font-semibold mb-0.5" style={{ color: 'var(--tx-2)' }}>{label}</p>
      <p className="font-bold text-[14px] text-cyan-400">{payload[0].value} errors</p>
    </div>
  )
}

function buildRange(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), errors: 0 }
  })
}

export default function TechDashboardPage() {
  const supabase = createClient()
  const [incidents, setIncidents]   = useState<Incident[]>([])
  const [recentErrors, setErrors]   = useState<AuditEntry[]>([])
  const [stats, setStats]           = useState<Stats>({ openIncidents: 0, criticalErrors: 0, flaggedFlags: 0 })
  const [errorTrend, setErrorTrend] = useState(buildRange(10))
  const [loading, setLoading]       = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: incData }, { data: errData }, { data: flagData }] = await Promise.all([
      supabase.from('incidents').select('id,title,severity,status,created_at,type')
        .neq('status', 'resolved').order('created_at', { ascending: false }).limit(6),
      supabase.from('audit_logs').select('id,event,severity,created_at,actor_email')
        .in('severity', ['critical', 'error', 'warning']).order('created_at', { ascending: false }).limit(10),
      supabase.from('feature_flags').select('id').eq('enabled', false),
    ])

    const pts = buildRange(10)
    for (const e of errData ?? []) {
      const day = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const found = pts.find(p => p.date === day)
      if (found) found.errors++
    }
    setErrorTrend(pts)

    setIncidents((incData ?? []) as Incident[])
    setErrors((errData ?? []) as AuditEntry[])
    setStats({
      openIncidents: (incData ?? []).length,
      criticalErrors: (errData ?? []).filter(e => e.severity === 'critical' || e.severity === 'error').length,
      flaggedFlags: (flagData ?? []).length,
    })
    setLoading(false)
  }

  const quickActions = [
    { label: 'User Doctor',      href: '/tech/user-doctor',   desc: 'Diagnose user issues',  Icon: Code2 },
    { label: 'API Console',      href: '/tech/api-console',   desc: 'Test API endpoints',    Icon: Terminal },
    { label: 'DB Explorer',      href: '/tech/database',      desc: 'Run read-only queries', Icon: Database },
    { label: 'Env Checker',      href: '/tech/env-check',     desc: 'Validate environment',  Icon: Shield },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Open Incidents',
      value: stats.openIncidents,
      sub: 'Unresolved incidents',
      href: '/tech/incidents',
      Icon: AlertTriangle,
      color: '#F87171',
      bg: 'rgba(239,68,68,0.12)',
      urgent: stats.openIncidents > 0,
    },
    {
      label: 'Critical Errors',
      value: stats.criticalErrors,
      sub: 'From last 24 hours',
      href: '/tech/error-feed',
      Icon: ZapOff,
      color: '#FB923C',
      bg: 'rgba(251,146,60,0.12)',
      urgent: stats.criticalErrors > 3,
    },
    {
      label: 'Disabled Flags',
      value: stats.flaggedFlags,
      sub: 'Feature flags off',
      href: '/tech/feature-flags',
      Icon: Flag,
      color: '#22D3EE',
      bg: 'rgba(6,182,212,0.12)',
      urgent: false,
    },
  ]

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
              Technical Dashboard
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              System health, incidents, and diagnostics at a glance
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-3)' }}>
            <Activity size={12} />
            <span>Live</span>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats.openIncidents > 0 ? 'bg-rose-500' : 'bg-cyan-500'}`} />
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6 flex-1">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {statCards.map(c => (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 group"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: `1px solid ${c.urgent ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                boxShadow: 'var(--shadow-card)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(6,182,212,0.4)'
                el.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = c.urgent ? 'rgba(239,68,68,0.25)' : 'var(--border)'
                el.style.boxShadow = 'var(--shadow-card)'
              }}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                  <c.Icon size={18} style={{ color: c.color }} />
                </div>
                <ChevronRight size={14} style={{ color: 'var(--tx-3)' }}
                  className="group-hover:text-cyan-400 transition-colors" />
              </div>
              <div>
                <p className="text-[28px] font-bold font-display leading-none tracking-tight"
                  style={{ color: c.urgent ? c.color : 'var(--tx-1)' }}>
                  {c.value}
                </p>
                <p className="text-[12px] font-semibold mt-1.5 text-cyan-400">{c.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{c.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Chart + Open incidents */}
        <div className="grid grid-cols-3 gap-5">
          {/* Error trend chart */}
          <div className="col-span-1 rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="mb-4">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Error Trend</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>Errors/warnings — last 10 days</p>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={errorTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--tx-3)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false} axisLine={false} interval={2} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="errors" stroke="#06B6D4" strokeWidth={2}
                  fill="url(#techGrad)" dot={false}
                  activeDot={{ r: 4, fill: '#06B6D4', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Open incidents */}
          <div className="col-span-2 rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Open Incidents</p>
              <Link href="/tech/incidents" className="text-[12px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {incidents.length === 0 ? (
              <div className="flex items-center gap-4 py-5 px-3 rounded-xl"
                style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>All systems operational</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-3)' }}>No open incidents right now</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <Zap size={11} />
                  Healthy
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {incidents.map(inc => {
                  const sev = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.info
                  return (
                    <li key={inc.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-elevated)' }}>
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STATUS_DOT[inc.status] ?? '#6B7280' }} />
                        <div>
                          <p className="text-[13px] font-medium" style={{ color: 'var(--tx-1)' }}>{inc.title}</p>
                          <p className="text-[10px] capitalize" style={{ color: 'var(--tx-3)' }}>
                            {inc.type} · {timeDiff(inc.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border"
                        style={{ color: sev.text, backgroundColor: sev.bg, borderColor: sev.border }}>
                        {inc.severity}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Recent errors + Quick actions */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>Recent Error Events</p>
              <Link href="/tech/error-feed" className="text-[12px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                Live feed <ChevronRight size={12} />
              </Link>
            </div>
            {recentErrors.length === 0 ? (
              <p className="text-[13px] py-6 text-center" style={{ color: 'var(--tx-3)' }}>No recent error events.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentErrors.map(e => {
                  const sev = SEVERITY_STYLE[e.severity] ?? SEVERITY_STYLE.info
                  return (
                    <li key={e.id} className="py-2.5 flex items-start gap-3">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 mt-0.5 font-mono"
                        style={{ color: sev.text, backgroundColor: sev.bg, borderColor: sev.border }}>
                        {e.severity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-mono truncate" style={{ color: 'var(--tx-1)' }}>{e.event}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                          {e.actor_email ?? 'system'} · {timeDiff(e.created_at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[14px] font-semibold mb-4" style={{ color: 'var(--tx-1)' }}>Quick Actions</p>
            <div className="space-y-2">
              {quickActions.map(qa => (
                <Link key={qa.href} href={qa.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent transition-all duration-150 group"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(6,182,212,0.35)'
                    el.style.backgroundColor = 'rgba(6,182,212,0.05)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'transparent'
                    el.style.backgroundColor = 'var(--bg-elevated)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <qa.Icon size={14} className="text-cyan-400 flex-shrink-0" />
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
    </div>
  )
}
