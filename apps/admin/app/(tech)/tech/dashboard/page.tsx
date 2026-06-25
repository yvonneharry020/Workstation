'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Incident {
  id: string
  title: string
  severity: string
  status: string
  created_at: string
  type: string
}

interface AuditEntry {
  id: string
  event: string
  severity: string
  created_at: string
  actor_email: string | null
  metadata: Record<string, unknown>
}

interface Stats {
  openIncidents: number
  criticalErrors: number
  flaggedFlags: number
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-900/20 border-red-800/30',
  high: 'text-orange-400 bg-orange-900/20 border-orange-800/30',
  medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
  low: 'text-green-400 bg-green-900/20 border-green-800/30',
  info: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  error: 'text-red-400 bg-red-900/20 border-red-800/30',
  warning: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500',
  investigating: 'bg-orange-500',
  identified: 'bg-yellow-500',
  monitoring: 'bg-blue-500',
  resolved: 'bg-green-500',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
}

export default function TechDashboardPage() {
  const supabase = createClient()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [recentErrors, setRecentErrors] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<Stats>({ openIncidents: 0, criticalErrors: 0, flaggedFlags: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const [{ data: incData }, { data: errData }, { data: flagData }] = await Promise.all([
      supabase.from('incidents').select('id,title,severity,status,created_at,type').neq('status', 'resolved').order('created_at', { ascending: false }).limit(5),
      supabase.from('audit_logs').select('id,event,severity,created_at,actor_email,metadata').in('severity', ['critical','error','warning']).order('created_at', { ascending: false }).limit(8),
      supabase.from('feature_flags').select('id').eq('enabled', false),
    ])
    setIncidents((incData ?? []) as Incident[])
    setRecentErrors((errData ?? []) as AuditEntry[])
    setStats({
      openIncidents: (incData ?? []).length,
      criticalErrors: (errData ?? []).filter(e => e.severity === 'critical' || e.severity === 'error').length,
      flaggedFlags: (flagData ?? []).length,
    })
    setLoading(false)
  }

  const statCards = [
    { label: 'Open Incidents', value: stats.openIncidents, color: 'tech-500', href: '/tech/incidents', icon: '⚡', desc: 'Unresolved incidents' },
    { label: 'Recent Errors', value: stats.criticalErrors, color: 'tech-500', href: '/tech/error-feed', icon: '🔴', desc: 'Critical & error events' },
    { label: 'Disabled Flags', value: stats.flaggedFlags, color: 'tech-500', href: '/tech/feature-flags', icon: '🚩', desc: 'Feature flags off' },
  ]

  const quickActions = [
    { label: 'User Doctor', href: '/tech/user-doctor', desc: 'Diagnose user issues' },
    { label: 'API Console', href: '/tech/api-console', desc: 'Test API endpoints' },
    { label: 'DB Explorer', href: '/tech/database', desc: 'Run read-only queries' },
    { label: 'Env Checker', href: '/tech/env-check', desc: 'Validate environment' },
  ]

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Technical Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">System health, incidents, and diagnostics at a glance.</p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-6xl">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {statCards.map((c) => (
                <Link key={c.label} href={c.href} className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-tech-500/40 transition-colors group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{c.icon}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-tech-400 transition-colors"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                  <div className="text-3xl font-bold text-text-primary font-display">{c.value}</div>
                  <div className="text-xs text-text-muted mt-1">{c.desc}</div>
                  <div className="text-xs font-semibold text-tech-400 mt-0.5">{c.label}</div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-surface-card border border-surface-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-text-primary">Open Incidents</p>
                  <Link href="/tech/incidents" className="text-xs text-tech-400 hover:text-tech-300 transition-colors">View all →</Link>
                </div>
                {incidents.length === 0 ? (
                  <div className="flex items-center gap-3 py-6">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">All systems operational</p>
                      <p className="text-xs text-text-muted">No open incidents right now</p>
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {incidents.map(inc => (
                      <li key={inc.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[inc.status] ?? 'bg-gray-500'}`} />
                          <div>
                            <p className="text-sm text-text-primary">{inc.title}</p>
                            <p className="text-[10px] text-text-muted capitalize">{inc.type} · {formatTime(inc.created_at)}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[inc.severity] ?? ''}`}>{inc.severity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col">
                <p className="text-sm font-semibold text-text-primary mb-4">Quick Actions</p>
                <div className="space-y-2 flex-1">
                  {quickActions.map(qa => (
                    <Link key={qa.href} href={qa.href} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated hover:bg-tech-900/20 hover:border-tech-800/30 border border-transparent transition-colors group">
                      <div>
                        <p className="text-sm text-text-primary group-hover:text-tech-300 transition-colors">{qa.label}</p>
                        <p className="text-[10px] text-text-muted">{qa.desc}</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-text-primary">Recent Error Events</p>
                <Link href="/tech/error-feed" className="text-xs text-tech-400 hover:text-tech-300 transition-colors">Live feed →</Link>
              </div>
              {recentErrors.length === 0 ? (
                <p className="text-sm text-text-muted py-3">No recent error events.</p>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {recentErrors.map(e => (
                    <li key={e.id} className="py-2.5 flex items-start gap-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${SEVERITY_COLORS[e.severity] ?? ''}`}>{e.severity.toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">{e.event}</p>
                        <p className="text-[10px] text-text-muted">{e.actor_email ?? 'system'} · {formatTime(e.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
