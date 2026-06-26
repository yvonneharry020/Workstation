'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Stats {
  pendingVerifications: number
  openTickets: number
  flaggedContent: number
  pendingJobs: number
  openAnnouncements: number
}

interface AuditEntry {
  id: string
  event: string
  created_at: string
  actor_email: string | null
  severity: string
  actor_type: string | null
}

function timeDiff(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function OpsDashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({ pendingVerifications: 0, openTickets: 0, flaggedContent: 0, pendingJobs: 0, openAnnouncements: 0 })
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    const [
      { count: candCount },
      { count: compCount },
      { count: ticketCount },
      { count: jobCount },
      { data: activityData },
    ] = await Promise.all([
      supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('audit_logs').select('id,event,created_at,actor_email,severity,actor_type').order('created_at', { ascending: false }).limit(10),
    ])
    setStats({
      pendingVerifications: (candCount ?? 0) + (compCount ?? 0),
      openTickets: ticketCount ?? 0,
      flaggedContent: 0,
      pendingJobs: jobCount ?? 0,
      openAnnouncements: 0,
    })
    setRecentActivity((activityData ?? []) as AuditEntry[])
    setLoading(false)
  }

  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'text-red-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  }

  const statCards = [
    { label: 'Pending Verifications', value: stats.pendingVerifications, href: '/ops/verifications', icon: '🛡️', urgent: stats.pendingVerifications > 10 },
    { label: 'Open Tickets', value: stats.openTickets, href: '/ops/support', icon: '🎫', urgent: stats.openTickets > 5 },
    { label: 'Pending Job Posts', value: stats.pendingJobs, href: '/ops/jobs', icon: '💼', urgent: false },
    { label: 'Active Users Today', value: recentActivity.length, href: '/ops/users', icon: '👥', urgent: false },
  ]

  const quickActions = [
    { label: 'Verification Queue', href: '/ops/verifications', desc: 'Review pending users' },
    { label: 'SLA Monitor', href: '/ops/sla-monitor', desc: 'Check response times' },
    { label: 'Announcements', href: '/ops/announcements', desc: 'Broadcast messages' },
    { label: 'Badge Management', href: '/ops/badges', desc: 'Issue or revoke badges' },
  ]

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Management Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">Operations overview — verifications, support, moderation, and trust & safety.</p>
      </div>

      <div className="px-8 py-6 max-w-6xl space-y-6">
        {loading ? <div className="text-text-muted text-sm">Loading…</div> : (
          <>
            <div className="grid grid-cols-4 gap-4">
              {statCards.map(c => (
                <Link key={c.label} href={c.href} className={`bg-surface-card border rounded-xl p-5 hover:border-ops-500/40 transition-colors group ${c.urgent ? 'border-orange-800/40' : 'border-surface-border'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{c.icon}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-ops-400 transition-colors"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                  <div className={`text-3xl font-bold font-display ${c.urgent ? 'text-orange-400' : 'text-text-primary'}`}>{c.value}</div>
                  <div className="text-xs text-text-muted mt-1">{c.label}</div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-surface-card border border-surface-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-text-primary">Recent Activity</p>
                </div>
                <ul className="divide-y divide-surface-border">
                  {recentActivity.map(e => (
                    <li key={e.id} className="py-2.5 flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase w-12 flex-shrink-0 ${SEVERITY_COLORS[e.severity] ?? 'text-text-muted'}`}>{e.severity}</span>
                      <span className="text-xs text-text-secondary flex-1 font-mono truncate">{e.event}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">{e.actor_email ?? e.actor_type ?? 'system'}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">{timeDiff(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <p className="text-sm font-semibold text-text-primary mb-4">Quick Actions</p>
                <div className="space-y-2">
                  {quickActions.map(qa => (
                    <Link key={qa.href} href={qa.href} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated hover:bg-ops-900/20 hover:border-ops-800/30 border border-transparent transition-colors group">
                      <div>
                        <p className="text-sm text-text-primary group-hover:text-ops-300 transition-colors">{qa.label}</p>
                        <p className="text-[10px] text-text-muted">{qa.desc}</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
